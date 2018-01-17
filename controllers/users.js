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
    User.findOneAndUpdate({ _id: req.body.id }, req.body).then(user => {
        if (!user) return res.status(404).send('No user with that ID');
        return res.sendStatus(200);
    }).catch(next);
};


exports.deleteUser = (req, res, next) => {
    User.findByIdAndRemove(req.body.id)
    .then(user => res.sendStatus(200))
    .catch(next);
}

/*
* Location routes
*/

exports.findNearbyRandom = (req, res, next) => {
    // update status of target user
    User.findOneAndUpdate({ _id: req.body.id }, req.body).then(user => {
        if (!user) return res.status(404).send('Could not find user: invalid id');
        return user
    }).then((user) => {
        // query1 finds users within 1.6 km (about 1 miles) of target user
        // function adapted from https://stackoverflow.com/questions/13840516/how-to-find-my-distance-to-a-known-location-in-javascript
        let query1 = "function() {"
        query1 += "let lat1 = " + (user.latitude || 10000) + ";"
        query1 += "let lon1 = " + (user.longitude || 10000) + ";"
        query1 += "let lat2 = this.latitude || 10000;"
        query1 += "let lon2 = this.longitude || 10000;"
        query1 += "if (typeof(Number.prototype.toRad) === 'undefined') {"
        query1 += "Number.prototype.toRad = function() {"
        query1 += "return this * Math.PI / 180;}};"
        query1 += "let R = 6371;"
        query1 += "let dLat = (lat2-lat1).toRad();"
        query1 += "let dLon = (lon2-lon1).toRad();"
        query1 += "let a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1.toRad()) * Math.cos(lat2.toRad()) *Math.sin(dLon/2) * Math.sin(dLon/2);"
        query1 += "let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));"
        query1 += "let d = R * c;"
        query1 += "return d < 1.6; }"

        // query2 ensures that the target user does not find himself/herself
        let query2 = "" + user._id

        User.find({ $and: [
            { $where: query1 },
            { _id: { $ne: query2 } }
        ]
    }).then(users => {
        let userIdList = users.map(user => {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            phoneNumber: user.phoneNumber,
            latitude: user.latitude,
            classYear: user.classYear,
            house: user.house,
            longitude: user.longitude,
            interests: user.interests,
            classes: user.classes,
            status: user.status
        })
        if (userIdList.length <= 3) {
            res.json(userIdList)
        } else {
            let retUserIdList = []
            for (let i = 0; i < 3; i++) {
                let randIndex = Math.floor(Math.random() * userIdList.length)
                // delete random userId from original array and add it to the return array (deletion prevents repeated elements)
                retUserIdList.push(userIdList.splice(randIndex, 1)[0])
            }
            res.json(retUserIdList)
        }
        }).catch(next)
    }).catch(next)
}


exports.findNearbyInterests = (req, res, next) => {
    // update status of target user
    User.findOneAndUpdate({ _id: req.body.id }, req.body).then(user => {
        if (!user) return res.status(404).send('Could not find user: invalid id');
        return user
    }).then((user) => {
        // query1 finds users within 1.6 km (about 1 miles) of target user
        // function adapted from https://stackoverflow.com/questions/13840516/how-to-find-my-distance-to-a-known-location-in-javascript
        let query1 = "function() {"
        query1 += "let lat1 = " + (user.latitude || 10000) + ";"
        query1 += "let lon1 = " + (user.longitude || 10000) + ";"
        query1 += "let lat2 = this.latitude || 10000;"
        query1 += "let lon2 = this.longitude || 10000;"
        query1 += "if (typeof(Number.prototype.toRad) === 'undefined') {"
        query1 += "Number.prototype.toRad = function() {"
        query1 += "return this * Math.PI / 180;}};"
        query1 += "let R = 6371;"
        query1 += "let dLat = (lat2-lat1).toRad();"
        query1 += "let dLon = (lon2-lon1).toRad();"
        query1 += "let a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1.toRad()) * Math.cos(lat2.toRad()) *Math.sin(dLon/2) * Math.sin(dLon/2);"
        query1 += "let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));"
        query1 += "let d = R * c;"
        query1 += "return d < 1.6; }"

        // query2 ensures that the target user does not find himself/herself
        let query2 = "" + user._id

        // query3 finds nearby users that have at least one common interest
        let query3 = "function () {"
        query3 += "return (('" + user.interests  + "'.split(',')).filter( " + "(element) => this.interests.includes(element) ) ).length > 0 }"

        User.find({ $and: [
            { $where: query1 },
            { _id: { $ne: query2 } },
            { $where: query3 }
        ]
    }).then(users => {
        let userIdList = users.map(user => {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            phoneNumber: user.phoneNumber,
            latitude: user.latitude,
            classYear: user.classYear,
            house: user.house,
            longitude: user.longitude,
            interests: user.interests,
            classes: user.classes,
            status: user.status
        })
        if (userIdList.length <= 3) {
            res.json(userIdList)
        } else {
            let retUserIdList = []
            for (let i = 0; i < 3; i++) {
                let randIndex = Math.floor(Math.random() * userIdList.length)
                // delete random userId from original array and add it to the return array (deletion prevents repeated elements)
                retUserIdList.push(userIdList.splice(randIndex, 1)[0])
            }
            res.json(retUserIdList)
        }
        }).catch(next)
    }).catch(next)
}

exports.findNearbyClasses = (req, res, next) => {
    // update status of target user
    User.findOneAndUpdate({ _id: req.body.id }, req.body).then(user => {
        if (!user) return res.status(404).send('Could not find user: invalid id');
        return user
    }).then((user) => {
        // query1 finds users within 1.6 km (about 1 miles) of target user
        // function adapted from https://stackoverflow.com/questions/13840516/how-to-find-my-distance-to-a-known-location-in-javascript
        let query1 = "function() {"
        query1 += "let lat1 = " + (user.latitude || 10000) + ";"
        query1 += "let lon1 = " + (user.longitude || 10000) + ";"
        query1 += "let lat2 = this.latitude || 10000;"
        query1 += "let lon2 = this.longitude || 10000;"
        query1 += "if (typeof(Number.prototype.toRad) === 'undefined') {"
        query1 += "Number.prototype.toRad = function() {"
        query1 += "return this * Math.PI / 180;}};"
        query1 += "let R = 6371;"
        query1 += "let dLat = (lat2-lat1).toRad();"
        query1 += "let dLon = (lon2-lon1).toRad();"
        query1 += "let a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1.toRad()) * Math.cos(lat2.toRad()) *Math.sin(dLon/2) * Math.sin(dLon/2);"
        query1 += "let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));"
        query1 += "let d = R * c;"
        query1 += "return d < 1.6; }"

        // query2 ensures that the target user does not find himself/herself
        let query2 = "" + user._id

        // query3 finds nearby users that have at least one common class
        let query3 = "function () {"
        query3 += "return (('" + user.classes  + "'.split(',')).filter( " + "(element) => this.classes.includes(element) ) ).length > 0 }"

        User.find({ $and: [
            { $where: query1 },
            { _id: { $ne: query2 } },
            { $where: query3 }
        ]
    }).then(users => {
        let userIdList = users.map(user => {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            phoneNumber: user.phoneNumber,
            latitude: user.latitude,
            classYear: user.classYear,
            house: user.house,
            longitude: user.longitude,
            interests: user.interests,
            classes: user.classes,
            status: user.status
        })
        if (userIdList.length <= 3) {
            res.json(userIdList)
        } else {
            let retUserIdList = []
            for (let i = 0; i < 3; i++) {
                let randIndex = Math.floor(Math.random() * userIdList.length)
                // delete random userId from original array and add it to the return array (deletion prevents repeated elements)
                retUserIdList.push(userIdList.splice(randIndex, 1)[0])
            }
            res.json(retUserIdList)
        }
        }).catch(next)
    }).catch(next)
}


exports.findNearbyStatus = (req, res, next) => {
    // update status of target user
    User.findOneAndUpdate({ _id: req.body.id }, req.body).then(user => {
        if (!user) return res.status(404).send('Could not find user: invalid id');
        return user
    }).then((user) => {
        // query1 finds users within 1.6 km (about 1 miles) of target user
        // function adapted from https://stackoverflow.com/questions/13840516/how-to-find-my-distance-to-a-known-location-in-javascript
        let query1 = "function() {"
        query1 += "let lat1 = " + (user.latitude || 10000) + ";"
        query1 += "let lon1 = " + (user.longitude || 10000) + ";"
        query1 += "let lat2 = this.latitude || 10000;"
        query1 += "let lon2 = this.longitude || 10000;"
        query1 += "if (typeof(Number.prototype.toRad) === 'undefined') {"
        query1 += "Number.prototype.toRad = function() {"
        query1 += "return this * Math.PI / 180;}};"
        query1 += "let R = 6371;"
        query1 += "let dLat = (lat2-lat1).toRad();"
        query1 += "let dLon = (lon2-lon1).toRad();"
        query1 += "let a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1.toRad()) * Math.cos(lat2.toRad()) *Math.sin(dLon/2) * Math.sin(dLon/2);"
        query1 += "let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));"
        query1 += "let d = R * c;"
        query1 += "return d < 1.6; }"

        // query2 ensures that the target user does not find himself/herself
        let query2 = "" + user._id

        // query3 finds users with same status as target user
        let query3 = ("" + req.body.status) || "unavailable"

        User.find({ $and: [
            { $where: query1 },
            { _id: { $ne: query2 } },
            { status: { $eq: query3 } }
        ]
    }).then(users => {
        let userList = users.map(user => {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            phoneNumber: user.phoneNumber,
            latitude: user.latitude,
            classYear: user.classYear,
            house: user.house,
            longitude: user.longitude,
            interests: user.interests,
            classes: user.classes,
            status: user.status
        })
        if (userList.length <= 3) {
            res.json(userList)
        } else {
            let retUserList = []
            for (let i = 0; i < 3; i++) {
                let randIndex = Math.floor(Math.random() * userList.length)
                // delete random userId from original array and add it to the return array (deletion prevents repeated elements)
                retUserIdList.push(userList.splice(randIndex, 1)[0])
            }
            res.json(retUserList)
        }
        }).catch(next)
    }).catch(next)
}

// TODO
// find nearby users by status ("work", "eat", "play", "random"/"surprise") - based on location
// status: "eat" - filter by *interests* or classes
// status: "play" - filter by *interests* or classes
// status: "work" - filter by classes
// status: "surprise" - other user must also have status "surprise"
// concatenate status as string
// choose one or many users after finding (depending on what user wants to see) - 3 users max
// function to pass phone number to frontend
