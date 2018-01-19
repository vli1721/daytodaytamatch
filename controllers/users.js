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
        email: req.body.email,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        hash: req.body.password,
        phoneNumber: req.body.phoneNumber,
        classYear: req.body.classYear,
        house: req.body.house,
        interests: req.body.interests || [],
        classes: req.body.classes || [],
        status: 'unavailable',
        matches: []
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
    let userClasses = []
    let updatingClasses = false
    for (key in req.body) {
        if (key.indexOf('classes') >= 0) {
            userClasses.push(req.body[key])
            delete req.body[key]
            updatingClasses = true
        }
    }
    if (updatingClasses) {
        req.body.classes = userClasses
    }
    let userInterests = []
    let updatingInterests = false
    for (key in req.body) {
        if (key.indexOf('interests') >= 0) {
            userInterests.push(req.body[key])
            delete req.body[key]
            updatingInterests = true
        }
    }
    if (updatingInterests) {
        req.body.interests = userInterests
    }
    console.log(req.body)
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

exports.clearMatches = (req, res, next) => {
    console.log('clearing matches')
    User.findOneAndUpdate({ _id: req.body.id }, { matches: []}).then(user => {
        if (!user) return res.status(404).send('Could not find user: invalid id');
        next()
    })
}


/*=============================================
=              Location routes                =
=============================================*/
exports.findNearby = (req, res, next) => {
    // update status of target user
    req.body.interests = JSON.parse(req.body.interests)
    req.body.classes = JSON.parse(req.body.classes)
    console.log(req.body.interests)
    console.log(req.body.classes)
    // update status and location of target user
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
        let query2 = String(user._id)

        // query3 finds users with same status as target user if both users chose surprise
        let query3
        if (String(req.body.status) === "tree.start") {
            query3 = "function () { return this.status === '" + req.body.status + "' }"
        } else { // query3 finds users with status includes status of target user if user does not choose surprise
            query3 = "function () { return this.status.indexOf('" + req.body.status + "') >= 0 }"
        }

        // if status is exactly "work", query4 finds nearby users that have at least one common class
        let query4
        if (String(req.body.status) === "tree.start.work") {
            query4 = "function () { return (('" + user.classes  + "'.split(',')).filter( " + "(element) => this.classes.includes(element) ) ).length > 0 }"
        } // else if status is exactly "eat" or exactly "play", query4 finds nearby users that have at least one common interest
        else if (String(req.body.status) === "tree.start.eat" || String(req.body.status) === "tree.start.play") {
            query4 = "function () { return (('" + user.interests  + "'.split(',')).filter( " + "(element) => this.interests.includes(element) ) ).length > 0 }"
        } // else make query4 true
        else {
            query4 = "true"
        }
        User.find({ $and: [
            { $where: query1 },
            { _id: { $ne: query2 } },
            { $where: query3 },
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
                status: userMatch.status,
                matches: userMatch.matches
            }
        })
        let retUserMatchList = []
        if (userMatchList.length <= 3) {
            for (let i = 0; i < userMatchList.length; i++) {
                retUserMatchList.push(userMatchList[i])
            }
        } else {
            for (let i = 0; i < 3; i++) {
                let randIndex = Math.floor(Math.random() * userMatchList.length)
                // delete random userId from original array and add it to the return array (deletion prevents repeated elements)
                retUserMatchList.push(userMatchList.splice(randIndex, 1)[0])
            }
        }
        let promises = []
        for (let i = 0; i < retUserMatchList.length; i++) {
            if (!user.matches.includes(String(retUserMatchList[i].id))) {
                promises.push(User.findOneAndUpdate({ _id: user._id }, { $push: { matches: retUserMatchList[i].id } }))
            }
            if (!retUserMatchList[i].matches.includes(String(user._id))) {
                promises.push(User.findOneAndUpdate({ _id: retUserMatchList[i].id }, { $push: { matches: user._id } }))
            }
            retUserMatchList[i].distance = (parseFloat(distance(userLon, userLat, retUserMatchList[i].longitude, retUserMatchList[i].latitude)) * 0.621371).toFixed(2)
            delete retUserMatchList[i].latitude
            delete retUserMatchList[i].longitude
        }
        Promise.all(promises).then(results => {
            res.json(retUserMatchList)
            }).catch(next)

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
