/** 
 * A util function which can be used as middleware function for rate limiting.
 * It uses sliding window algorithm.
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

function FixedWindowLimiterMiddleware(options) {
    options = Object.assign({
        points: Number.MAX_SAFE_INTEGER,
        amount: 1,
        duration: 3600,
        limiterPrefix: "RLMiddleware:",
        keyGenerator: (req) => req.ip,
        handler: function (req, res, next) {
            res.status(429).send("Too many requests, please try again later.");
        }
    }, options);

    async function consume(req, res, next) {

        /**
         * This method checks if request can be processed for the key and consumes "amount" number of points.
         */

        let redisClient = options.redisClient;
        let dPoints = options.points;
        let amount = options.amount;
        let duration = options.duration;
        let limiterPrefix = options.limiterPrefix;

        const reqTime = Date.now();
        let fullKey = `${limiterPrefix}:${options.keyGenerator(req)}`;

        if (!fullKey) {
            next();
            return true;
        }

        /* Initializing redis operations
            1. Get the value of the request key 
        */
        let redisOperations = [
            ['get', fullKey]
        ];

        let results = await redisClient.multi(redisOperations).exec();

        // Getting requests count of the request id
        let currCount = parseInt(results[0][1], 10);
        currCount = isNaN(currCount) ? 0 : currCount;

        // Rejecting if current window count is greater than max points limit defined.
        if (currCount >= dPoints) {
            return options.handler(req, res, next);
        }

        /*
            Initializing redis operations for incrementing request count by amount and setting TTL 
            if we do not want to just check but consume.
        */
        redisOperations = [];
        redisOperations.push(['incrby', fullKey, amount]);
        redisOperations.push(['expire', fullKey, duration]);
        results.push(await redisClient.multi(redisOperations).exec());

        next();
        return true;

    }

    return consume;
};

module.exports = FixedWindowLimiterMiddleware;