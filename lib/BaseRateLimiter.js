class BaseRateLimiter {

    /**
     * 
     * @param {*} options :
     * options for initializing rate limiter.
     * 1. duration - Number of seconds for which requests should be remembered.
     * 2. points - Maximum number of points that can be consumed over time window.
     * 3. limiterPrefix - rate limiter key prefix
     */
    constructor(options) {
        this.duration = options.duration;
        this.points = options.points;
        this.limiterPrefix = options.limiterPrefix;
        this.redisClient = options.redisClient;
        if (options.windowLogInterval) {
            this.windowLogInterval = options.windowLogInterval;
        }
    }

    resultObj(allowed, consumedPoints, consumed = false) {
        let remaining = allowed - consumedPoints;
        remaining = remaining > 0 ? remaining : 0;

        let exceeded = consumedPoints - allowed;
        exceeded = exceeded > 0 ? exceeded : 0;

        let obj = {
            allowed: allowed,
            consumedPoints: consumedPoints,
            remaining: remaining,
            exceeded: exceeded,
            consumed: consumed
        };

        return obj;
    }

    getPromise(obj, shouldResolve = true) {
        return new Promise((resolve, reject) => { return shouldResolve ? resolve(obj) : reject(obj); });
    }

};


module.exports = BaseRateLimiter;