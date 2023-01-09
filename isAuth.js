const isAuth = (req, res, next) => {
    if (req.session.user) {
        // IF USER EXISTS
        next()
    } else {
        res.send({loggedIn: false})
    }
}

module.exports = { isAuth }