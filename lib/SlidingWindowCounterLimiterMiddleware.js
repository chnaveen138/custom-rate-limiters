/** 
 * A util function which can be used as middleware function for rate limiting.
 * It uses sliding window counter algorithm.
 */

/**
 * 
 * @param {*} options :
 * Different options to initialize rate limiter
 * 1. duration - Number of seconds for which requests should be remembered.
 * 2. points - Maximum number of points that can be consumed over time window.
 * 3. amount - Number of points to be consumed for the request.
 * 4. keyGenerator - identifer against which limit should be applied.
 * 5. handler - Function to handle the rejection. 
 * 6. limiterPrefix - Which prefix should be used for the redis keys created by this limiter.
 * @returns rejects or continues based on conditions.
 * 
 * USAGE EXAMPLE:
 * Limit requests for a route. Max of 3 per 60 seconds.
 * Initialize ratelimiter as below:
 * let rateLimiter = CustomRateLimiterMiddleware(
    {
        points : 3,
        duration : 60,
        limiterPrefix: "RLSomeRoute:",
        keyGenerator: function(req, res){
            return req.params.userId;
        }
    }
);
* Use the ratelimiter in the routes.
* Eg. app.post('/someroute', rateLimiter, handleRequest);
*/

function SlidingWindowCounterLimiterMiddleware(options) {
    options = Object.assign({
        points: Number.MAX_SAFE_INTEGER,
        amount: 1,
        duration: 3600,
        limiterPrefix: "RLMiddleware:",
        windowLogInterval: 60,
        keyGenerator: (req) => req.ip,
        handler: function (req, res, next) {
            res.status(429).send("Too many requests, please try again later.");
        }
    }, options);

    function getWindowLogInterval(duration) {
        /**
         * We will be using sliding window counter algorithm for rate limits. In this algorithm, window time is
         * broken into small time intervals(buckets). In each bucket we will store the request count.
         * This method will return that bucket size for the provided duration. 
         */
        let WLI = duration;

        if (duration < 86400)
            WLI = duration / 30;
        else
            WLI = duration / 60;

        if (WLI > 1) {
            WLI = Math.floor(WLI);
        }
        return WLI;
    }

    async function consume(req, res, next) {

        /**
         * This method checks if request can be processed for the key and consumes "amount" number of points.
         */

        let redisClient = options.redisClient;
        let dPoints = options.points;
        let amount = options.amount;
        let duration = options.duration;
        let limiterPrefix = options.limiterPrefix;
        let windowLogInterval = (options && options.windowLogInterval) ? options.windowLogInterval : getWindowLogInterval(duration);

        const reqTime = Date.now();
        let fullKey = `${limiterPrefix}:${options.keyGenerator(req)}`;
        let record = await redisClient.get(fullKey);

        if (!fullKey) {
            next();
            return true;
        }


        /* Ensuring if record is available for the key in redis and if not will create new record in
        redis with the request log and sets TTL for the key */
        if (record === null) {
            let newRecord = [];
            let requestLog = {
                timestamp: reqTime,
                count: amount
            };
            newRecord.push(requestLog);
            let operations = [['set', fullKey, JSON.stringify(newRecord)], ['expire', fullKey, duration]];
            let result = await redisClient.multi(operations).exec();

            next();
            return true;
        }

        let currData = JSON.parse(record);
        let currWindowStart = Date.now() - (duration * 1000);
        let currWindowLogs = currData.filter(entry => entry.timestamp > currWindowStart);

        // Summing all request counts of buckets with timestamp greater than current window start timestamp.
        let currWindowCount = currWindowLogs.reduce((accumulator, entry) => (accumulator + entry.count), 0);

        // Rejecting if current window count is greater than max points limit defined.
        if (currWindowCount >= dPoints) {
            return options.handler(req, res, next);
        }

        let lastLog = currData[currData.length - 1];
        let pCurrWindowStart = reqTime - (windowLogInterval * 1000);

        /* If timestamp can still be included in the last bucket, we will just increment the 
        last log count. Else we will push new log for the key in redis. This is nothing but
        new bucket creation. */
        if (lastLog.timestamp > pCurrWindowStart) {
            lastLog.count += amount;
            currData[currData.length - 1] = lastLog;
        }
        else {
            let newLog = {
                timestamp: reqTime,
                count: amount
            };
            currData.push(newLog);
        }

        /* Filtering only such logs which belong to the current time window. We should do this
         to remove other unnecessary logs as there is no use of them further. */
        currData = currData.filter(entry => entry.timestamp >= currWindowStart);

        // Setting updated data for the key in redis and setting new TTL for the key.
        let operations = [['set', fullKey, JSON.stringify(currData)], ['expire', fullKey, duration]];
        let result = await redisClient.multi(operations).exec();

        next();

        return true;

    }

    return consume;
};

module.exports = SlidingWindowCounterLimiterMiddleware;