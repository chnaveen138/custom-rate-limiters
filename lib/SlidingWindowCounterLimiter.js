/** 
 * A util class which can be used for rate limiting.
 * It uses sliding window counter algorithm.
 */

let BaseRateLimiter = require('./BaseRateLimiter');

class SlidingWindowCounterLimiter extends BaseRateLimiter {

    getWindowLogInterval(duration) {
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
     * 2. windowLogInterval : 
     * window time is broken into small time intervals(buckets). Logs are maintained for each bucket. 
     * windowLogInterval = bucket size. 
     * If not provided, it will calculate suitable bucket size for the time window duration defined and use it as windowLogInterval.
     * Eg: opts.windowLogInterval = 5
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
        let windowLogInterval = this.windowLogInterval || this.getWindowLogInterval(this.duration);

        const reqTime = Date.now();
        let fullKey = `${this.limiterPrefix}:${id}`;
        let record = await redisClient.get(fullKey);

        /* Ensuring if record is available for the key in redis and if not will create new record in
        redis with the request log and sets TTL for the key */
        if (record === null) {
            let newRecord = [];
            let requestLog = {
                timestamp: reqTime,
                count: amount
            };
            newRecord.push(requestLog);
            if (!justCheck) {
                let operations = [['set', fullKey, JSON.stringify(newRecord)], ['expire', fullKey, this.duration]];
                let result = await redisClient.multi(operations).exec();
                return this.getPromise(this.resultObj(dPoints, amount, true));
            }
            else {
                return this.getPromise(this.resultObj(dPoints, 0));
            }
        }

        let currData = JSON.parse(record);
        let currWindowStart = Date.now() - (this.duration * 1000);
        let currWindowLogs = currData.filter(entry => entry.timestamp > currWindowStart);

        // Summing all request counts of buckets with timestamp greater than current window start timestamp.
        let currWindowCount = currWindowLogs.reduce((accumulator, entry) => (accumulator + entry.count), 0);

        // Rejecting if current window count is greater than max points limit defined.
        if (currWindowCount >= dPoints) {
            return this.getPromise(this.resultObj(dPoints, currWindowCount, false), false);
        }

        if (justCheck) {
            return this.getPromise(this.resultObj(dPoints, currWindowCount, false));
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
        let operations = [['set', fullKey, JSON.stringify(currData)], ['expire', fullKey, this.duration]];
        let result = await redisClient.multi(operations).exec();

        return this.getPromise(this.resultObj(dPoints, currWindowCount + amount, true));

    }
}

module.exports = SlidingWindowCounterLimiter;