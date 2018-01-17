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

router.route('/update-location')
  .put(users.updateUser)


router.route('/find-nearby-random')
  .put(users.findNearbyRandom)

router.route('/find-nearby-interests')
  .put(users.findNearbyInterests)

router.route('/find-nearby-classes')
  .put(users.findNearbyClasses)

router.route('/find-nearby-status')
  .put(users.findNearbyStatus)


/*
* Auth Routes
*/
router.route('/auth/login')
  .post(auth.loginUser);

// expose routes through router object
module.exports = router;
