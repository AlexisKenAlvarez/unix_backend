const mongoose = require("mongoose")

const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    items: [{
        productName: String,
        quantity: Number,
        price: Number,
        total: Number,
        img: {
            data: Buffer,
            contentType: String
        }
    }],
    createdAt: {
        type: Date,
        imuutable: true,
        default: () => Date.now()
    }
})

const User = new mongoose.model("Users", UserSchema)
module.exports = User