var path = require('path');
var express = require('express');
var router = express.Router();

var logger = require('../../logger');

router.use(function(err, req, res, next) {
    if (req.app.get('env') === 'development') {
        // development error handler
        // will print stacktrace
        res.status(err.status || 500);
        logger.error('Error page', {msg: err.message, data: err.data, stack: err.stack});
        res.render(path.join(__dirname, 'error'), {
            message: err.message,
            error: err,
            data: err.data,
        });
    } else {
        // production error handler
        // no stacktraces leaked to user
        res.status(err.status || 500);
        logger.error('Error page', {msg: err.message, data: err.data, stack: err.stack});
        res.render(path.join(__dirname, 'error'), {
            message: err.message,
            error: {}
        });
    }
});

module.exports = router;
