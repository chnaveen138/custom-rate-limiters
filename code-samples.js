// Import the installed modules.
const express = require('express');
const redis = require('ioredis');
let port = 3000;


const app = express();

let CustomRateLimiter = require('custom-rate-limiters').CustomRateLimiter;
let CustomRateLimiterMiddleware = require('custom-rate-limiters').CustomRateLimiterMiddleware;

// create and connect redis client to local instance.
const client = new redis();

// Print redis errors to the console
client.on('error', (err) => {
    console.log("Error " + err);
});

client.on('connect', function () {
    console.log('Connected!'); // Connected!
});

// ---------------Documentation for normal rate limiters-----------------

/**
 * * Options for middleware usage limiter:
 * 1. duration - Number of seconds for which requests should be remembered.
 * 2. points - Maximum number of points that can be consumed over time window.
 * 3. amount - Number of points to be consumed for the request.
 * 4. keyGenerator - identifer against which limit should be applied.
 * 5. handler - Function to handle the rejection. 
 * 6. limiterPrefix - Which prefix should be used for the redis keys created by this limiter.
 * 7. algorithm - Type of algorithm to be used for the rate limiter
 * 8. If algorithm is sliding-window-counter:
 *      windowLogInterval - Duration of sub window. Refer sliding window counter algorithm for more details.
 * */

// Initializing middleware type ratelimiter with fixed window algorithm
let fwRateLimiterMWOptions = {
    "duration": 60,
    "limiterPrefix": "RL60:FWMW",
    "points": 3,
    "algorithm": "fixed-window",
    "redisClient": client,
    "keyGenerator": function (req) {
        let userId = req && req.params && req.params.userId;
        userId = userId ? userId : "some_key";
        return userId;
    },
    handler: function (req, res, next) {
        res.status(429).send("Too many requests, please try again later.");
    }

};
let fwRateLimiterMW = new CustomRateLimiterMiddleware(fwRateLimiterMWOptions);

app.get('/fixedwindowmw/:userId', fwRateLimiterMW, async (req, res) => {
    res.send('Fixed window middleware');
});

/*
 * Initializing middleware type ratelimiter with sliding window algorithm
 * Here for each request 2 points will be consumed since we defined amount as 2 in the options. 
 */
let swRateLimiterMWOptions = {
    "duration": 60,
    "limiterPrefix": "RL60:SWMW",
    "points": 3,
    "amount": 2,
    "algorithm": "sliding-window",
    "redisClient": client,
    "keyGenerator": function (req) {
        let userId = req && req.params && req.params.userId;
        userId = userId ? userId : "some_key";
        return userId;
    },
    handler: function (req, res, next) {
        res.status(429).send("Too many requests, please try again later.");
    }

};
let swRateLimiterMW = new CustomRateLimiterMiddleware(swRateLimiterMWOptions);

app.get('/slidingwindowmw/:userId', swRateLimiterMW, async (req, res) => {
    res.send('Sliding window middleware');
});


/*
 * Initializing middleware type ratelimiter with sliding window counter algorithm
 * Here windowloginterval duration is defined as 1 second. If you are not sure what to define, let the default
 * mechanism handle that.
 * Refer sliding window counter algorithm for more details.
 */
let swcRateLimiterMWOptions = {
    "duration": 60,
    "limiterPrefix": "RL60:SWCMW",
    "points": 3,
    "algorithm": "sliding-window-counter",
    "redisClient": client,
    "windowLogInterval": 1,
    "keyGenerator": function (req) {
        let userId = req && req.params && req.params.userId;
        userId = userId ? userId : "some_key";
        return userId;
    },
    handler: function (req, res, next) {
        res.status(429).send("Too many requests, please try again later.");
    }

};
let swcRateLimiterMW = new CustomRateLimiterMiddleware(swcRateLimiterMWOptions);

app.get('/slidingwindowcountermw/:userId', swcRateLimiterMW, async (req, res) => {
    res.send('Sliding window counter middleware');
});


// ---------------Documentation for normal rate limiters-----------------

/**
 * Options for rate limiter:
 * 1. duration - Number of seconds for which requests should be remembered.
 * 2. points - Maximum number of points that can be consumed over time window.
 * 3. limiterPrefix - Which prefix should be used for the redis keys created by this limiter.
 * 4. algorithm - Type of algorithm to be used for the rate limiter
 * 5. If algorithm is sliding-window-counter:
 *      windowLogInterval - Duration of sub window. Refer sliding window counter algorithm for more details.
 * */


/**
 * About params of consume method of rate limiters:
 * @param {*} id : 
 * The identifier that need to be used to limit against.
 * Eg. If limit is for user, we will provide userId. id = "u-20fb8308-374e-5cac-81bd-5c996a435f5e"
 * @param {*} amount :
 * amount = How many points need to be consumed for the request.
 * @param {*} justCheck:
 * To just check if limit can be satisifed or not without consuming points.
 * If justCheck = true, it just checks, else it checks and consumes.
 * @param {*} opts:
 * 
 * 1. dPoints :
 * Maximum number of points that can be consumed over time window.
 * If not provided, it will use points value defined during initialization of current rate limiter.
 * Eg: opts.dPoints = 10;
 * 2. windowLogInterval : (Only applicable for sliding-window-counter algorithm)
 * window time is broken into small time intervals(buckets). Logs are maintained for each bucket. 
 * windowLogInterval = bucket size. 
 * If not provided, it will calculate suitable bucket size for the time window duration defined and use it as windowLogInterval.
 * Eg: opts.windowLogInterval = 5
 * @returns
 * Resolved or rejected promise accordingly.
 */

// Initializing ratelimiter with fixed window algorithm
app.get('/fixedwindow/:userId', async (req, res) => {
    let rateLimiterOptions = {
        "duration": 60,
        "limiterPrefix": "RL60:FW",
        "points": 3,
        "algorithm": "fixed-window",
        "redisClient": client
    };

    let rateLimiter = new CustomRateLimiter(rateLimiterOptions);
    let userId = req && req.params && req.params.userId || "someuserid";
    let validateP = rateLimiter.consume(userId, undefined, false);

    return validateP
        .then((accResult) => {
            console.log("Accepted request: ", JSON.stringify(accResult));
            res.send('Fixed window successful');
        })
        .catch((rejResult) => {
            console.log("Rejected request: ", JSON.stringify(rejResult));
            res.status(429).send("Too many requests, please try again later.");
        });
});

/*
 * Initializing ratelimiter with sliding window algorithm
 * Here for each request 2 points will be consumed since we defined amount as 2 in the options. 
 */
app.get('/slidingwindow/:userId', async (req, res) => {
    let rateLimiterOptions = {
        "duration": 60,
        "limiterPrefix": "RL60:SW",
        "points": 4,
        "algorithm": "sliding-window",
        "redisClient": client
    };

    let rateLimiter = new CustomRateLimiter(rateLimiterOptions);
    let userId = req && req.params && req.params.userId || "someuserid";
    let validateP = rateLimiter.consume(userId, 2, false);

    return validateP
        .then((accResult) => {
            console.log("Accepted request: ", JSON.stringify(accResult));
            res.send('Sliding window successful');
        })
        .catch((rejResult) => {
            console.log("Rejected request: ", JSON.stringify(rejResult));
            res.status(429).send("Too many requests, please try again later.");
        });
});

/*
 * Initializing middleware type ratelimiter with sliding window counter algorithm
 * Here windowloginterval duration is defined as 2 second. If you are not sure what to define, let the default
 * mechanism handle that.
 * Refer sliding window counter algorithm for more details.
 */
app.get('/slidingwindowcounter/:userId', async (req, res) => {
    let rateLimiterOptions = {
        "duration": 60,
        "limiterPrefix": "RL60:SWC",
        "points": 3,
        "windowLogInterval": 2,
        "algorithm": "sliding-window-counter",
        "redisClient": client
    };

    let rateLimiter = new CustomRateLimiter(rateLimiterOptions);
    let userId = req && req.params && req.params.userId || "someuserid";
    let validateP = rateLimiter.consume(userId, undefined, false);

    return validateP
        .then((accResult) => {
            console.log("Accepted request: ", JSON.stringify(accResult));
            res.send('Sliding window counter successful');
        })
        .catch((rejResult) => {
            console.log("Rejected request: ", JSON.stringify(rejResult));
            res.status(429).send("Too many requests, please try again later.");
        });
});

/*
   If you need to have multiple limits for a feature, then you can checkout the below code sample of
   how to use ratelimiters to validate multiple limits.
   Below example feature requirement: 
   max number of points per 30 seconds - 4
   max number of points per 60 seconds - 6
*/
app.get('/multiplelimits/:userId', async (req, res) => {
    let rateLimiterOptions = {
        "algorithm": "sliding-window-counter",
        "redisClient": client
    };
    let userId = req && req.params && req.params.userId || "someuserid";

    let rateLimiter30 = new CustomRateLimiter({ "limiterPrefix": "RL30:SWML", "duration": 30, ...rateLimiterOptions });
    let rateLimiter60 = new CustomRateLimiter({ "limiterPrefix": "RL60:SWML", "duration": 60, ...rateLimiterOptions });
    let allValidationsP = [
        rateLimiter30.consume(userId, undefined, true, { dPoints: 4 }),
        rateLimiter60.consume(userId, undefined, true, { dPoints: 6 })
    ];
    return Promise.all(allValidationsP)
        .then((accResult) => {
            console.log("Accepted request: ", JSON.stringify(accResult));
            let allConsumptionsP = [
                rateLimiter30.consume(userId, undefined, false, { dPoints: 4 }),
                rateLimiter60.consume(userId, undefined, false, { dPoints: 6 })
            ];
            return Promise.all(allConsumptionsP).finally(function () {
                res.send('Multiple limits validation successful');
            });
        })
        .catch((rejResult) => {
            console.log("Rejected request: ", JSON.stringify(rejResult));
            res.status(429).send("Too many requests, please try again later.");
        });
});


app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})