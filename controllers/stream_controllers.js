const zegoTokenService = require("../config/zegoTokenConfig")
const live_schema = require("../models/live_session")
const product_schema = require("../models/product_schema")
const user_schema = require("../models/user_schema")
const { generateToken04 } = require('./zegoServerAssistant');
const appID = parseInt(process.env.ZEGO_APP_ID);
const secret = process.env.ZEGO_SERVER_SECRET;
const effectiveTimeInSeconds = 3600;
const payload = '';

const { validationResult, body, query, param } = require('express-validator');
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, 
    max: 30, 
    message: { error: "Too many requests, please try again later." }
});

const validateInitiateLive = [
    body('title').isString().notEmpty(),
    body('language').isString().notEmpty(),
    body('items').isArray(),
];

const validatePagination = [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    param('lang').optional().isString(),
];

const generate_zego_token = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId || typeof userId !== 'string') {
            return res.status(400).json({ success: false, error: "Invalid user ID" });
        }
        const token = generateToken04(appID, userId, secret, effectiveTimeInSeconds, payload);

        if (!token) {
            return res.status(500).json({
                success: false,
                error: "Token generation failed",
            });
        }
        res.status(200).json({
            success: true,
            token
        });
    } catch (err) {
        console.error(`[TOKEN_ERROR] ${new Date().toISOString()}`, {
            userId: req.user?.id,
            error: err.message
        });

        res.status(500).json({
            success: false,
            error: "Token generation failed",
        });
    }
};

const initiate_live = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: 'Invalid input', details: errors.array() });
        }

        const userId = req.user.id;
        const { title, language, items } = req.body;
        const roomId = `live_${userId}_${Date.now()}`;
        const token = generateToken04(appID, userId, secret, effectiveTimeInSeconds, payload);

        const existingSession = await live_schema.findOne({ seller: userId, status: 'live' });
        if (existingSession) {
            return res.status(409).json({
                error: 'You already have an active live session',
                existingSessionId: existingSession._id,
                existingRoomId: existingSession.zegoRoomId
            });
        }

        const obj = new live_schema({
            seller: userId,
            zegoRoomId: roomId,
            title: title,
            language: language,
            status: "scheduled",
            featuredProducts: items
        });

        await obj.save();
        res.status(201).json({
            success: true,
            roomId,
            token,
            expiresIn: effectiveTimeInSeconds
        });
    }
    catch (err) {
        console.error(`InitiateLiveError: ${err.message}`, {
            userId: req.user?.id,
            timestamp: new Date().toISOString()
        });

        res.status(500).json({
            error: 'Internal server error',
        });
    }
};

const start_live = async (req, res) => {
    try {
        const roomId = req.params.id;
        const userId = req.user.id;

        if (!roomId || typeof roomId !== 'string') {
            return res.status(400).json({ error: 'Invalid or missing roomId' });
        }

        const updatedSession = await live_schema.findOneAndUpdate(
            {
                zegoRoomId: roomId,
                seller: userId,
                status: 'scheduled'
            },
            {
                $set: {
                    status: 'live',
                    startTime: new Date(),
                    updatedAt: new Date()
                }
            },
            { new: true }
        );

        if (!updatedSession) {
            return res.status(404).json({
                error: 'Session not found or already live'
            });
        }

        const productDetails = await product_schema.find({
            _id: { $in: updatedSession.featuredProducts }
        }).select("-__v -createdAt -updatedAt");

        res.status(200).json({
            success: true,
            session: {
                roomId: updatedSession.zegoRoomId,
                status: updatedSession.status,
                startTime: updatedSession.startTime,
                featuredProducts: productDetails
            }
        });

    } catch (err) {
        console.error('StartLive Error:', err.message);
        res.status(500).json({
            error: 'Failed to start live session'
        });
    }
};

const end_live = async (req, res) => {
    try {
        const roomId = req.params.id;
        const userId = req.user.id;
        if (!roomId || typeof roomId !== 'string') {
            return res.status(400).json({
                error: 'roomId is required in request params'
            });
        }
        const updatedSession = await live_schema.findOneAndUpdate(
            {
                zegoRoomId: roomId,
                seller: userId,
                status: 'live'
            },
            {
                $set: {
                    status: 'ended',
                    endTime: new Date(),
                    updatedAt: new Date()
                }
            },
            { new: true }
        );
        if (!updatedSession) {
            return res.status(404).json({
                error: 'No live session found with this roomId',
                possibleReasons: [
                    'Session does not exist',
                    'Session already ended',
                    'You are not the owner'
                ]
            });
        }
        return res.status(200).json({
            success: true,
            session: {
                roomId: updatedSession.zegoRoomId,
                status: updatedSession.status,
                startTime: updatedSession.startTime
            }
        });
    }
    catch (err) {
        console.error(`[${new Date().toISOString()}] EndLiveError:`, {
            userId: req.user?.id,
            roomId: req.params?.id,
            error: err.message
        });

        res.status(500).json({
            error: 'Failed to end live session',
            suggestion: 'Try again or contact support'
        });
    }
};

const active_live = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: 'Invalid input', details: errors.array() });
        }

        const lang = req.params.lang;

        const query = {
            status: 'live',
            ...(lang && { language: lang })
        };

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        let live_sessions = await live_schema.find(query)
            .select('-__v')
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('seller', 'name sellerInfo')
            .populate('featuredProducts', 'name category price images tags')
            .lean();
        const total = await live_schema.countDocuments(query);

        res.set('Cache-Control', 'public, max-age=30');

        return res.status(200).json({
            success: true,
            count: live_sessions.length,
            total,
            sessions: live_sessions,
            page,
            limit,
            timestamp: new Date().toISOString()
        });

    } catch (err) {
        console.error(`[ACTIVE_LIVE_ERROR] ${new Date().toISOString()}`, {
            params: req.params,
            error: err.message
        });

        return res.status(500).json({
            success: false,
            error: 'Failed to retrieve live sessions',
            suggestion: 'Please try again later'
        });
    }
};

module.exports = {
    generate_zego_token,
    initiate_live,
    start_live,
    end_live,
    active_live,
    validateInitiateLive,
    validatePagination,
    apiLimiter
}