/** 
 * A util class which can be used for rate limiting.
 * It uses sliding window algorithm.
 */

let BaseRateLimiter = require('./BaseRateLimiter');

class SlidingWindowLimiter extends BaseRateLimiter {

    /**
     * 
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
     * 
     * @returns
     * Resolved or rejected promise accordingly.
     */
    async consume(id, amount, justCheck = false, opts = {}) {

        /**
         * This method checks if request can be processed for the key and consumes "amount" number of points.
         */

        let redisClient = this.redisClient;
        let dPoints = (opts && opts.dPoints) || this.points;
        amount = amount ? amount : 1;

        const reqTime = Date.now();
        let fullKey = `${this.limiterPrefix}:${id}`;
        let currWindowStart = Date.now() - (this.duration * 1000);


        /* Initializing redis operations
            1. removes all request timestamps for the key which are older than current time window.
            2. Get the number of request timestamps present for the key. 
        */
        let redisOperations = [
            ['zremrangebyscore', fullKey, 0, currWindowStart],
            ['zcard', fullKey]
        ];

        /*
            Initializing redis operations for adding new request timestamps and setting TTL 
            if we do not want to just check but consume.
        */
        if (!justCheck) {
            redisOperations.push(['zadd', fullKey]);
            redisOperations.push(['expire', fullKey, this.duration]);

            for (let i = 1; i <= amount; i++) {
                redisOperations[2].push(reqTime);
                redisOperations[2].push(`req-${i}:${reqTime}`);
            }
        }


        let results = await redisClient.multi(redisOperations).exec();

        // Getting all requests count of current time window.
        let currWindowCount = parseInt(results[1][1], 10);

        // Rejecting if current window count is greater than max points limit defined.
        if (currWindowCount >= dPoints) {
            return this.getPromise(this.resultObj(dPoints, currWindowCount, false), false);
        }

        if (justCheck) {
            return this.getPromise(this.resultObj(dPoints, currWindowCount, false));
        }

        return this.getPromise(this.resultObj(dPoints, currWindowCount + amount, true));

    }
}

module.exports = SlidingWindowLimiter;