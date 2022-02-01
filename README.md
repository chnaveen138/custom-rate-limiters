<div id="top"></div>

[![MIT License][license-shield]][license-url]
[![LinkedIn][linkedin-shield]][linkedin-url]



<br />
<div align="center">

  <h3 align="center">Custom rate limiters</h3>

  <p align="center">
    Rate limiters that support multiple algorithms and can be used to validate multiple limits for a feature if needed
    <br />
    <a href="#usage">View Documentation</a>
    ·
    <a href="https://github.com/chnaveen138/custom-rate-limiters/issues">Report Bug</a>
    ·
    <a href="https://github.com/chnaveen138/custom-rate-limiters/issues">Request Feature</a>
  </p>
</div>



<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li>
      <a href="#usage">Usage</a>
      <ul>
        <li><a href="#about-middleware-type-rate-limiters">Middleware type ratelimiters</a></li>
        <li><a href="#about-normal-rate-limiters">Normal ratelimiters</a></li>
      </ul>
    </li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
  </ol>
</details>



<!-- ABOUT THE PROJECT -->
## About The Project

Using this package, you can add rate-limiting functionality to your projects. Currently, it only supports Redis as DB but we will add support for other DBs as well in the future.

Here's why this package is unique:
* It supports multiple algorithms. Currently, you can choose between **fixed-window**, **sliding-window**, and **sliding-window-counter** algorithms.
* You can define two types of rate limiters - Normal rate limiters and rate limiters which can be used as middleware validations. Please refer <a href="#usage">usage section</a> for the code samples.
* It supports such kind of implementation where you can validate multiple rate limits for a feature if you have any such requirement. Please refer <a href="#usage">usage section</a> for the code samples.
* No dependencies with other packages. So you need not worry about security vulnerabilities.

We'll be adding support to more DBs and algorithms soon. You may also suggest changes by forking this repo and creating a pull request or opening an issue. Thanks to all the people who have contributed to expanding this template!

<p align="right">(<a href="#top">back to top</a>)</p>


<!-- GETTING STARTED -->
## Getting Started

Instructions on setting up this project locally.
To get a local copy up and running follow these simple example steps.

### Installation

* Installing package from npm:
   ```sh
   npm install custom-rate-limiters
   ```
* Cloning repo from GitHub:
   ```sh
   git clone https://github.com/chnaveen138/custom-rate-limiters.git
   ```

<p align="right">(<a href="#top">back to top</a>)</p>



<!-- USAGE EXAMPLES -->
## Usage

Please refer below documentation about params and examples of using rate limiters.
<br />
We recommend using **"ioredis"** for creating redis client.
```js
const Redis = require("ioredis");
const client = new Redis();
```

<br />

### About middleware type rate limiters
`let rateLimiterMW = new CustomRateLimiterMiddleware(options);`
#### Options for middleware type rate limiter:
- `duration` - Number of seconds for which requests info should be remembered.
- `points` - Maximum number of points that can be consumed over the duration window.
- `amount` - Number of points to be consumed for each request.
- `keyGenerator` - Function that generates unique identifer against which limit will be applied.
- `handler` - Function to handle the rejection. 
- `limiterPrefix` - Which prefix should be used for the redis keys created by this limiter.
- `algorithm` - Type of algorithm to be used for the rate limiter. Values can be - `fixed-window`, `sliding-window`, `sliding-window-counter`
- `windowLogInterval` - bucket size (Only applicable for sliding-window-counter algorithm).
    Window time is broken into small time intervals(buckets). Logs are maintained for each bucket.
    If not provided, it will calculate suitable bucket size for the time window duration defined and use it as windowLogInterval.
    Refer sliding window counter algorithm for more details.

<br />

#### Default options for middleware type rate limiter:

```js
{
    points: Number.MAX_SAFE_INTEGER,
    amount: 1,
    duration: 3600,
    limiterPrefix: "RLMiddleware:",
    algorithm: "sliding-window-counter",
    keyGenerator: (req) => req.ip,
    handler: function (req, res, next) {
        res.status(429).send("Too many requests, please try again later.");
    }
 }
```
<br />

#### Code samples

##### Using middleware type ratelimiter with sliding window counter algorithm:
```js
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
```
<br />

### About normal rate limiters
`let rateLimiter = new CustomRateLimiter(options);`
#### Options for normal rate limiters:
- `duration` - Number of seconds for which requests info should be remembered.
- `points` - Maximum number of points that can be consumed over the duration window.
- `limiterPrefix` - Which prefix should be used for the redis keys created by this limiter.
- `algorithm` - Type of algorithm to be used for the rate limiter. Values can be - `fixed-window`, `sliding-window`, `sliding-window-counter`
- `windowLogInterval` - bucket size (Only applicable for sliding-window-counter algorithm).
    Window time is broken into small time intervals(buckets). Logs are maintained for each bucket.
    If not provided, it will calculate suitable bucket size for the time window duration defined and use it as windowLogInterval.
    Refer sliding window counter algorithm for more details.

<br />

#### Documentation about params of `consume` function:
`async consume(id, amount, justCheck = false, opts = {})`
- `id` - The identifier that need to be used to limit against.
- `amount` - How many points need to be consumed for the request.
- `justCheck` - To just check if limit can be satisifed or not without consuming points. Will be useful in validating multiple limits of a feature if any such requirement.
- `opts`
	- `dPoints`             - Maximum number of points that can be consumed over time window. If not provided, it will use points value defined during initialization of current rate limiter.

<br />

#### About `resultObj` of the rate limiter:
```js
let validateP = rateLimiter.consume(userId, undefined, false);
return validateP
        .then((resultObj) => {
        })
        .catch((resultObj) => {
        });
```
- `allowed` - Number of points that are allowed in the current time window
- `consumedPoints` - Number of points already consumed in the current time window
- `remaining` - Remaining number of points that can be consumed in the current time window
- `exceeded` - Exceeded points in the current time window
- `consumed` - Are points consumed for the current request or not

#### Example result object:
```js
{
   "allowed":3,
   "consumedPoints":1,
   "remaining":2,
   "exceeded":0,
   "consumed":true
}
```

<br />

#### Code samples

##### Using normal ratelimiter with sliding window counter algorithm:

```js
/*
 * Initializing middleware type ratelimiter with sliding window counter algorithm
 * Here windowloginterval duration is defined as 2 second. If you are not sure what to define, let the default
 * mechanism handle that.
 * Refer sliding window counter algorithm for more details.
 */
 
let rateLimiterOptions = {
    "duration": 60,
    "limiterPrefix": "RL60:SWC",
    "points": 3,
    "windowLogInterval": 2,
    "algorithm": "sliding-window-counter",
    "redisClient": client
};
let rateLimiter = new CustomRateLimiter(rateLimiterOptions);

app.get('/slidingwindowcounter/:userId', async (req, res) => {
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
```
<br />

##### Implementation for validating multiple limits if any such requirement:

```js
/*
   If you need to have multiple limits for a feature, then you can checkout the below code sample of
   how to use ratelimiters to validate multiple limits.
   Below example feature requirement: 
    max number of points per 30 seconds should be 4
    max number of points per 60 seconds should be 6
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
```

<p align="right">(<a href="#top">back to top</a>)</p>

<!-- CONTRIBUTING -->
## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<p align="right">(<a href="#top">back to top</a>)</p>



<!-- LICENSE -->
## License

Distributed under the MIT License. See `LICENSE.txt` for more information.

<p align="right">(<a href="#top">back to top</a>)</p>



<!-- CONTACT -->
## Contact

Your Name - [Naveen Chelimilla](https://in.linkedin.com/in/chelimilla-naveen) - chelimilla.naveen@gmail.com

Project Link: [https://github.com/chnaveen138/custom-rate-limiters](https://github.com/chnaveen138/custom-rate-limiters)

<p align="right">(<a href="#top">back to top</a>)</p>


<!-- MARKDOWN LINKS & IMAGES -->
[issues-shield]: https://img.shields.io/github/issues/othneildrew/Best-README-Template.svg?style=for-the-badge
[issues-url]: https://github.com/chnaveen138/custom-rate-limiters/issues
[license-shield]: https://img.shields.io/github/license/othneildrew/Best-README-Template.svg?style=for-the-badge
[license-url]: https://opensource.org/licenses/MIT
[linkedin-shield]: https://img.shields.io/badge/-LinkedIn-black.svg?style=for-the-badge&logo=linkedin&colorB=555
[linkedin-url]: https://in.linkedin.com/in/chelimilla-naveen
