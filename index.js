const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose")
const { isAuth } = require('./isAuth')

const app = express();
const bcrypt = require("bcryptjs")
const saltRounds = 10;

const bodyParser = require("body-parser")
const cookieParser = require("cookie-parser")
const session = require("express-session")

const multer = require("multer")
const fs = require("fs")
const path = require("path")

const UserData = require("./modules/userSchema")
const Products = require('./modules/productSchema')

const dotenv = require('dotenv');
dotenv.config();

app.use(cors({credentials: true, origin: 'https://unix-e.netlify.app'}));
app.use(cookieParser());
app.use(express.json({limit: "50mb"}));
app.use(express.urlencoded({
    limit: "50mb",
    extended: true,
    parameterLimit: 100000
}));

app.set('trust proxy', 1);


app.use(session({
    key: "userid",  
    secret: process.env.SECRETKEY,
    resave: false,
    saveUninitialized: false,
    name: 'MyUnixWebsite', // This needs to be unique per-host.
    proxy: true, // Required for Heroku & Digital Ocean (regarding X-Forwarded-For)
    cookie: {
        secure: true, // required for cookies to work on HTTPS
        httpOnly: false,
        sameSite: 'none',
      }
}))

mongoose.connect(process.env.MONGODB_URI, 
    {
        useNewUrlParser: true,
    }
)

const storage = multer.diskStorage({
    destination: (req,file,cb) => {
        cb(null, "uploads")
    },  
    filename: (req, file, cb) => {
        cb(null, file.originalname)
    }
})

const upload = multer({storage: storage})

app.post('/addProduct', upload.single('prodimg'), (req, res) => {

    const item = new Products({
        productName: "Unix Phone Case",
        stock: 99999,
        price: 40.00,
        oldprice: 50.00,
        img: {
            data: fs.readFileSync("uploads/" + req.file.filename),
            contentType: "image/webp"
        }

    });

    item.save().then((response) => {
        res.send({Response: response})
    }).catch((err) => {
        res.send({Error: err})
    })
})


app.post("/register", async (req, res) => {

    const email = req.body.email
    const password = req.body.password

    try {
        bcrypt.genSalt(saltRounds, async (err, salt) => {
            bcrypt.hash(password, salt, async (err, hash) => {
                const User = new UserData({email: email, password: hash});
                await User.save();
                });
          });
        res.send("Inserted data")
    } catch (error) {
        res.send(error)
    }
})

app.post("/login", async (req, res) => {
    const email = req.body.email
    const password = req.body.password

    const User = await UserData.findOne({email: email})

    UserData.find({email: email}, {email: 1}, (err, result) => {
        if (err) {
            console.log(err)
        } else {
            if (result.length > 0) {
                bcrypt.compare(password, User.password, (err, check) => {
                    if (err) {
                        console.log(err)
                    } 

                    if (check) {

                        req.session.user = result

                        var oneWeek = 60 * 60 * 24; //1 weeks  
                        req.session.user.expires = new Date(Date.now() + oneWeek);
                        req.session.user.maxAge = oneWeek; 

                        res.send( {loggedIn: true} )
                    } else {
                        res.send( {loggedIn: false} )

                    }
                })
            } else {
                res.send({ result: "This user doenst exist"})
            }
        }
    })

})

app.post("/checkEmail", (req, res) => {

    const email = req.body.email

    UserData.find({email: email}, {email:1}, (err, result) => {
        if (err) {
            console.log(err)
        } else {
            if (result.length > 0) {
                res.send( {valid: false} )
            } else {
                res.send( {valid: true} )

            }
        }
        
    })
    
      
})

app.get('/login', (req, res) => {
    if (req.session.user) {
        res.send({loggedIn: true, user: req.session.user})
    } else {
        res.send({loggedIn: false})
    }
})

app.post('/logout', (req, res) => {
    if (req.session.user) {
        req.session.user = null
        req.session.destroy();
        res.send({out: true})

    } else {
        res.send({out: false})
    }
})

app.get('/getproducts', async (req,res) => {
    const products = await Products.find()

    res.json({Products: products})
})

app.post('/products', isAuth, async (req, res) => {
    const userEmail = req.session.user
    const email = userEmail[0].email


    const User = await UserData.findOne({email: email})
    const items = User.items
    const cart = []

    items.forEach((items) => {
        cart.push(items)
    })
    
    res.send({ items: cart })
}) 

app.post('/addtocart', isAuth, async (req, res) => {
    const product = req.body.product
    const quantity = 1
    const userEmail = req.session.user
    const email = userEmail[0].email

    let isNewItem = []
    
    const ProductList = await Products.findOne({productName: product})
    const User = await UserData.findOne({email: email})

    const userproduct = User.items


    const itemPrice = ProductList.price
    const itemImage = ProductList.img

    userproduct.forEach((items) => {
        const productName = items.productName
        if (productName == product) {
            isNewItem.push(productName)
        }
    })

    if(isNewItem.length > 0) {
        // FOR INCREMENTING EXISTING PRODUCT QUANTITY
        UserData.updateOne({email: email, "items.productName": isNewItem[0]}, { $inc : {"items.$.quantity": 1, "items.$.total": itemPrice}}, (err, result) => {
            if (err) {
                console.log(err)
                res.send(err)
            }
    
            if (result) {
                res.send({status: "Quantity of an item increased"})
            }
        })
    } else {
        // FOR NEW ADD TO CARTS
        UserData.updateOne({
            email: email}, 
            { 
                $push : {
                    items: [{
                        productName: product, 
                        quantity: quantity,
                        price: itemPrice,
                        total: itemPrice,
                        img: itemImage
                    }]
                }
            }, (err, result) => {

            if (err) {
                console.log(err)
                res.send(err)
            }
    
            if (result) {
                res.send({status: product})
            }
        })
    }

})

app.post("/handleQuantity", async (req, res) => {
    const action = req.body.action
    const productName = req.body.productName
    const userEmail = req.session.user
    const email = userEmail[0].email

    const ProductData = await Products.findOne({productName: productName})
    const productPrice = ProductData.price

    const User = await UserData.findOne({email: email})
    const useritems = User.items

    const UserQuantity = await UserData.findOne({email: email}, {items: {$elemMatch: {productName: productName}}, quantity: 1})
    const quantity = UserQuantity.items[0].quantity

    if (action === "add") {
        UserData.updateOne(
            {
                email: email, "items.productName": productName
            }, 
            {
                $inc : {
                    "items.$.quantity" : 1, "items.$.total" : productPrice
                }
            }, (err, result) => {
                if (err) {
                    console.log(err)
                } else {
                    res.send({result: "Success", price: productPrice})
                }

            }
            )
    } else if (action === "minus") {
        if (quantity === 1) {
            res.send({Action: "Delete"})
        } else {
            UserData.updateOne(
                {
                    email: email, "items.productName": productName
                }, 
                {
                    $inc : {
                        "items.$.quantity" : -1, "items.$.total" : -productPrice
                    }
                }, (err, result) => {
                    if (err) {
                        console.log(err)
                    } else {
                        res.send({status: "Success", price: productPrice})
                    }
                }
                )
        }
    }

})

app.post("/delete", async (req, res) => {
    const userEmail = req.session.user
    const email = userEmail[0].email
    const productName = req.body.productName

    UserData.updateOne({email: email}, {$pull : {items: {productName: productName}}}, (err, result) => {
        if (err) {
            console.log(err)
        } else {
            res.send({status: "success"})
        }
    })
})


const PORT = 3001

app.listen(process.env.PORT, () => {
    console.log("Connected at 3001")
})

// PRODUCT UPLOADER




