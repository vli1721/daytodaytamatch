'use strict';

const express = require('express');
const router = express.Router();

const auth = require('../controllers/auth')
const users = require('../controllers/users')


/*
* User Routes
*/
router.route('/users')
  .post(users.createUser)
  .get(users.getAllUsers)
  .put(users.updateUser)
  .delete(users.deleteUser)

router.route('/find-nearby')
  .put(users.clearMatches, users.findNearby)


/*
* Auth Routes
*/
router.route('/auth/login')
  .post(auth.loginUser);

router.route('/auth/logoff')
	.post(auth.logoffUser)

// expose routes through router object
module.exports = router;
