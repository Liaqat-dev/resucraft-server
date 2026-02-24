class AppError extends Error {
    constructor(message, statusCode, errors = null) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.errors = errors;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}


function sendErrorProd(error, response) {
    //Sent By Developer so send details to user
    if (error.isOperational) {
        response.status(error.statusCode).json({
            status: error.status,
            message: error.message
        })
    } else {
        // Unknown Programming Error so no need to leak details to user just send simple msg
        console.error('Error: ', error);
        response.status(500).json({
            status: 'fail',
            message: 'Something went wrong'
        })
    }
}

function sendErrorDev(error, response) {
    response.status(error.statusCode).json({
        status: error.status,
        error: error,
        message: error.message,
        stack: error.stack
    })

}

function handleCastErrorDB(error) {
    console.log('In Cast Error');
    const message = `Invalid : ${error.path} : ${error.value}`
    return new AppError(message, 400)

}

// function handleDuplicateFieldDB(error) {
//     console.log('In Duplicate Field Error');
//     const message = `Duplicate Field Value. Please use another value`;
//     return new AppError(message, 400);
// }

function handleDuplicateFieldDB(error) {
    const field = Object.keys(error.keyValue)[0];
    const value = error.keyValue[field];

    return new AppError(
        "Duplicate field value",
        409,
        {
            [field]: `${value} is already in use`
        }
    );
}

function handleValidationErrorDB(error) {
    const fieldErrors = {};

    Object.values(error.errors).forEach(err => {
        fieldErrors[err.path] = err.message;
    });


    return new AppError(
        "Validation failed",
        400,
        fieldErrors
    );
}


// function handleValidationErrorDB(error) {
//     console.log('In Validation Error');
//     const errors = Object.values(error.errors).map(err => err.message)
//     const message = `Invalid Input Data. ${errors.join('. ')}`;
//     return new AppError(message, 400);
// }

function handleJWTError() {
    return new AppError(`Invalid token! Please login to continue`, 400);
}

function handleJWTExpireError() {
    return new AppError(`Token expired! Please login to continue`, 400);
}

const globalErrorHandler = (error, request, response, next) => {
    console.log(error.message);

    error.statusCode = error.statusCode || 500;
    error.status = error.status || 'error';
    let err = error;
    if (err.name === 'CastError') {
        err = handleCastErrorDB(error);
    }
    if (err.code === 11000) {
        err = handleDuplicateFieldDB(error);
    }
    if (err.name === 'ValidationError') {
        err = handleValidationErrorDB(error);
    }
    if (err.name === 'JsonWebTokenError') {
        err = handleJWTError();
    }
    if (err.name === 'TokenExpiredError') {
        err = handleJWTExpireError();
    }

    if (process.env.NODE_ENV === 'production') {
        sendErrorProd(err, response);
    } else {
        sendErrorDev(err, response);
    }
}


export {globalErrorHandler, AppError};
