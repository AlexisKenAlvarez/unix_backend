const mongoose = require("mongoose")

const productSchema = new mongoose.Schema({

    productName: {
        type: String
    },
    stock: {
        type: Number
    },
    price: {
        type: Number
    },
    oldprice: {
        type: Number
    },
    img: {
        data: Buffer,
        contentType: String
    }

})

const products = new mongoose.model("products", productSchema)
module.exports = products