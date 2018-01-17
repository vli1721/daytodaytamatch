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
  .get(users.getAllUsers) //rather than get user by id
  .put(users.updateUser) // took out validate user
  .delete(auth.validateUser, users.deleteUser)

/*
* Beta testing
*/
router.route('/nearby')
	.get(users.findNearbyUsers)
/*
* Auth Routes
*/
router.route('/auth/login')
  .post(auth.loginUser);

// expose routes through router object
module.exports = router;
