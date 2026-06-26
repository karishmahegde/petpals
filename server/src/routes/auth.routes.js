const express = require('express');
const { successResponse } = require('../utils/response');
const authController = require('../controllers/auth.controller');

const router = express.Router();

router.post('/register', authController.register);

router.post('/login', authController.login);

router.post('/logout', (req, res) => {
  successResponse(res, 'logout endpoint', null);
});

router.post('/refresh-token', (req, res) => {
  successResponse(res, 'refresh-token endpoint', null);
});

module.exports = router;
