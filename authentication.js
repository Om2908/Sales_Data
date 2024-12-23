const jwt=require('jsonwebtoken');


const authenticate = (req, res, next) => {
    const token = req.header('token');
    if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

    try {
        const decoded = jwt.verify(token, 'omm');
        req.user = decoded;
        next();
    } catch (err) {
        res.status(400).json({ error: 'Invalid token or relogin' });
    }
};

const authorize = (req, res, next) => {
    if (req.user.User != 'admin') {
        return res.status(403).json({ error: 'not accessible. Admin access required.' });
    }
    next();
};

module.exports={jwt,authenticate,authorize};


