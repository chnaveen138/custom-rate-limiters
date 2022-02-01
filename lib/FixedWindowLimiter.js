/** 
 * A util class which can be used for rate limiting.
 * It uses sliding window algorithm.
 */

let BaseRateLimiter = require('./BaseRateLimiter');

class FixedWindowLimiter extends BaseRateLimiter {

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


        // Rejecting if current count is greater than max points limit defined.
        if (currCount >= dPoints) {
            return this.getPromise(this.resultObj(dPoints, currCount, false), false);
        }

        if (justCheck) {
            return this.getPromise(this.resultObj(dPoints, currCount, false));
        }

        /*
            Initializing redis operations for incrementing request count by amount and setting TTL 
            if we do not want to just check but consume.
        */
        redisOperations = [];
        if (!justCheck) {
            redisOperations.push(['incrby', fullKey, amount]);
            redisOperations.push(['expire', fullKey, this.duration]);
        }
        results.push(await redisClient.multi(redisOperations).exec());

        return this.getPromise(this.resultObj(dPoints, currCount + amount, true));

    }
}

module.exports = FixedWindowLimiter;