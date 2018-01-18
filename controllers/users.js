const User = require('../models/schemas/user');
const config = require('../models/config');
const jwt = require('jwt-simple')


/*=============================================
=                C.R.U.D. routes              =
=============================================*/
exports.createUser = (req, res, next) => {

    // validate email (from http://emailregex.com)
    if (!(/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(req.body.email))) {
        return res.status(400).send('Invalid email');
    }
    if (!req.body.firstName) return res.status(400).send('Must provide first name')
    if (!req.body.lastName) return res.status(400).send('Must provide last name')
    if (!req.body.password) return res.status(400).send('Must provide password')
    if (!req.body.confirm) return res.status(400).send('Must provide confirm password')
    if (req.body.confirm !== req.body.password) return res.status(400).send('Passwords must match')
    if (!req.body.phoneNumber) return res.status(400).send('Must provide phone number')
    if (!req.body.classYear) return res.status(400).send('Must provide class year')
    if (!req.body.house) return res.status(400).send('Must provide house')

    const userData = {
        userData.email = req.body.email,
        userData.firstName = req.body.firstName,
        userData.lastName = req.body.lastName,
        userData.hash = req.body.password,
        userData.phoneNumber = req.body.phoneNumber,
        userData.classYear = req.body.classYear,
        userData.house = req.body.house
        userData.interests = req.body.interests || [],
        userData.classes = req.body.classes || [],
        userData.status = 'unavailable'
    }

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


/*=============================================
=              Location routes                =
=============================================*/
exports.findNearby = (req, res, next) => {
    // update status of target user
    User.findOneAndUpdate({ _id: req.body.id }, req.body).then(user => {
        if (!user) return res.status(404).send('Could not find user: invalid id');
        return user
    }).then((user) => {
        // query1 finds users within 0.8 km (about 0.5 miles) of target user
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
        query1 += "return d < 0.8; }"

        // query2 ensures that the target user does not find himself/herself
        let query2 = "" + user._id

        // query3 finds users with same status as target user
        let query3 = ("" + req.body.status) || "unavailable"

        // if status is exactly "work", query4 finds nearby users that have at least one common class
        let query4
        if (String(req.body.status) === "work") {
            query4 = "function () { return (('" + user.classes  + "'.split(',')).filter( " + "(element) => this.classes.includes(element) ) ).length > 0 }"
        } // else if status is exactly "eat" or exactly "play", query4 finds nearby users that have at least one common interest
        else if (String(req.body.status) === "eat" || String(req.body.status) === "play") {
            query4 = "function () { return (('" + user.interests  + "'.split(',')).filter( " + "(element) => this.interests.includes(element) ) ).length > 0 }"
        } // else make query4 true
        else {
            query4 = "true"
        }
        User.find({ $and: [
            { $where: query1 },
            { _id: { $ne: query2 } },
            { status: { $eq: query3 } },
            { $where: query4 }
        ]
    }).then(users => {
        let userLat = user.latitude
        let userLon = user.longitude
        let userMatchList = users.map(userMatch => {
            return {
                id: userMatch._id,
                firstName: userMatch.firstName,
                lastName: userMatch.lastName,
                phoneNumber: userMatch.phoneNumber,
                latitude: userMatch.latitude,
                classYear: userMatch.classYear,
                house: userMatch.house,
                longitude: userMatch.longitude,
                interests: userMatch.interests,
                classes: userMatch.classes,
                status: userMatch.status
            }
        })
        if (userMatchList.length <= 3) {
            for (let i = 0; i < userMatchList.length; i++) {
                userMatchList[i].distance = distance(userLon, userLat, userMatchList[i].longitude, userMatchList[i].latitude)
                delete userMatchList[i].latitude
                delete userMatchList[i].longitude
            }
            res.json(userMatchList)
        } else {
            let retUserMatchList = []
            for (let i = 0; i < 3; i++) {
                let randIndex = Math.floor(Math.random() * userMatchList.length)
                // delete random userId from original array and add it to the return array (deletion prevents repeated elements)
                retUserMatchList.push(userMatchList.splice(randIndex, 1)[0])
            }
            for (let i = 0; i < retUserMatchList.length; i++) {
                retUserMatchList[i].distance = distance(userLon, userLat, retUserMatchList[i].longitude, retUserMatchList[i].latitude)
                delete retUserMatchList[i].latitude
                delete retUserMatchList[i].longitude
            }
            res.json(retUserMatchList)
        }
        }).catch(next)
    }).catch(next)
}

// Helper function to calculate distance between two users, given latitude and longitude of each
// From https://stackoverflow.com/questions/13840516/how-to-find-my-distance-to-a-known-location-in-javascript
function distance(lon1, lat1, lon2, lat2) {
    /** Converts numeric degrees to radians */
    if (typeof(Number.prototype.toRad) === "undefined") {
        Number.prototype.toRad = function() {
            return this * Math.PI / 180;
      }
    }
    var R = 6371; // Radius of the earth in km
    var dLat = (lat2-lat1).toRad();  // Javascript functions in radians
    var dLon = (lon2-lon1).toRad();
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1.toRad()) * Math.cos(lat2.toRad()) *
          Math.sin(dLon/2) * Math.sin(dLon/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    var d = R * c; // Distance in km
    return d;
}
