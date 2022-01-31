let SlidingWindowCounterLimiter = require('./lib/SlidingWindowCounterLimiter');
let SlidingWindowCounterLimiterMiddleware = require('./lib/SlidingWindowCounterLimiterMiddleware');
let SlidingWindowLimiter = require('./lib/SlidingWindowLimiter');
let SlidingWindowLimiterMiddleware = require('./lib/SlidingWindowLimiterMiddleware');
let FixedWindowLimiter = require('./lib/FixedWindowLimiter');
let FixedWindowLimiterMiddleware = require('./lib/FixedWindowLimiterMiddleware');


function CustomRateLimiter(options) {
    switch (options && options.algorithm) {
        case 'sliding-window-counter':
            return new SlidingWindowCounterLimiter(options);
        case 'sliding-window':
            return new SlidingWindowLimiter(options);
        case 'fixed-window':
            return new FixedWindowLimiter(options);
        default:
            return new SlidingWindowCounterLimiter(options);
    }
}

function CustomRateLimiterMiddleware(options) {
    switch (options && options.algorithm) {
        case 'sliding-window-counter':
            return new SlidingWindowCounterLimiterMiddleware(options);
        case 'sliding-window':
            return new SlidingWindowLimiterMiddleware(options);
        case 'fixed-window':
            return new FixedWindowLimiterMiddleware(options);
        default:
            return new SlidingWindowCounterLimiterMiddleware(options);
    }
}

module.exports = {
    CustomRateLimiter: CustomRateLimiter,
    CustomRateLimiterMiddleware: CustomRateLimiterMiddleware
};