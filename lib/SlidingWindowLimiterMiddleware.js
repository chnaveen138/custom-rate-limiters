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

function SlidingWindowLimiterMiddleware(options) {
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
        let currWindowStart = Date.now() - (duration * 1000);

        if (!fullKey) {
            next();
            return true;
        }

        /* Initializing redis operations
            1. removes all request timestamps for the key which are older than current time window.
            2. Get the number of request timestamps present for the key. 
        */
        let redisOperations = [
            ['zremrangebyscore', fullKey, 0, currWindowStart],
            ['zcard', fullKey]
        ];

        let results = await redisClient.multi(redisOperations).exec();

        // Getting all requests count of current time window.
        let currWindowCount = parseInt(results[1][1], 10);

        // Rejecting if current window count is greater than max points limit defined.
        if (currWindowCount >= dPoints) {
            return options.handler(req, res, next);
        }

        /*
            Initializing redis operations for adding new request timestamps and setting TTL.
        */
        redisOperations = [];
        redisOperations.push(['zadd', fullKey]);
        redisOperations.push(['expire', fullKey, duration]);

        for (let i = 1; i <= amount; i++) {
            redisOperations[0].push(reqTime);
            redisOperations[0].push(`req-${i}:${reqTime}`);
        }
        results.push(await redisClient.multi(redisOperations).exec());

        next();
        return true;

    }

    return consume;
};

module.exports = SlidingWindowLimiterMiddleware;