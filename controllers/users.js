const User = require('../models/schemas/user');
const config = require('../models/config');
const jwt = require('jwt-simple')

/*
* C.R.U.D. routes
*/
exports.createUser = (req, res, next) => {

    const userData = {};
    // validate email
    // http://emailregex.com
    if (req.body.email) {
        if (!(/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(req.body.email)))
            return res.status(400).send('Invalid email');
        else
            userData.email = req.body.email;
    }
    if (!req.body.firstName) {
            return res.status(400).send('Must provide first name')
    }

    userData.firstName = req.body.firstName
    if (!req.body.lastName) {
            return res.status(400).send('Must provide last name')
    }
    userData.lastName = req.body.lastName
    // check if password was provided
    if (!req.body.password) {
            return res.status(400).send('Must provide password')
    }
    if (!req.body.confirm) {
            return res.status(400).send('Must provide confirm password')
    }
    if (req.body.confirm !== req.body.password) {
            return res.status(400).send('Passwords must match')
    }
    if (req.body.password)
        userData.hash = req.body.password;

    if (req.body.hash)
        userData.hash = req.body.hash;

    // add other data
    if (!req.body.phoneNumber) {
            return res.status(400).send('Must provide phone number')
    }
    userData.phoneNumber = req.body.phoneNumber

    if (!req.body.classYear) {
            return res.status(400).send('Must provide class year')
    }
    userData.classYear = req.body.classYear
    if (!req.body.house) {
            return res.status(400).send('Must provide house')
    }
    userData.house = req.body.house

    if (req.body.interests)
        userData.interests = req.body.interests
    if (req.body.classes)
        userData.classes = req.body.classes



    // create new user
    const newUser = new User(userData);
    newUser.save()
    .then(user => {
        if (!user) return res.status(500).send('User failed to create')

        let payload = {
            id: user._id,
            email: user.email
        }
        let token = jwt.encode(payload, config.token_secret);
        user.token = token;
        user.save()
        .then(user => {
            if (!user) return res.status(500).send('User failed to create')
            return res.json({
                userId: user._id,
                token: user.token
            })
        })
    }).catch(err => {
        if (err) {
            if (err.code === 11000)
                return res.status(400).send('Email already registered');
            return res.status(400).send(err.message);
        }
    });
};

exports.getAllUsers = (req, res, next) => {
    User.find({}).then(users => res.json(users)).catch(next);
}

exports.getUserById = (req, res, next) => {
    User.findById(req.body.id).then(user => {
        if (!user) return res.status(404).send('Could not find user: invalid id');
        return res.json(user)
    }).catch(next);
};

exports.updateUser = (req, res, next) => {
    User.findOneAndUpdate(req.body.id, req.body).then(user => {
        if (!user) return res.status(404).send('No user with that ID');
        return res.sendStatus(200);
    }).catch(next);
};

exports.deleteUser = (req, res, next) => {
    User.findByIdAndRemove(req.body.id)
    .then(user => res.sendStatus(200))
    .catch(next);
}
