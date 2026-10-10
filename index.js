const path = require("path");
const express = require('express');
const app = express();
const PORT = 3000;

const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

async function main() {
    await mongoose.connect('mongodb://127.0.0.1:27017/bookstore');
}

main()
.then(() => {console.log('DB Connected')})
.catch((err) => {console.log(err)});

const bookSchema = new mongoose.Schema({
    name: String,
    title: String,
    author: String,
    price: Number,
    category: String,
    image: String
});

const Book = mongoose.model('Book', bookSchema);
app.set('views',path.join(__dirname,'views'))
app.set('view engine','ejs')
app.set(express.static(path.join(__dirname,'public')));

app.locals.cart = [];

const escapeHtml = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

app.use(express.static('public'))
app.use(express.urlencoded({ extended: true }))

const transport = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    pool: true,
    maxConnections: 2,
    maxMessages: 20,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
    auth: {
        user: '',
        pass: ''
    },
    tls: {
        rejectUnauthorized: false
    }
});

app.get('/',(req,res)=>{
    res.render('home')
})
app.get('/about',(req,res)=>{
    res.render('about')
})
app.get('/books', async (req, res) => {
    const books = await Book.find();
    res.render('books', { books });
});

app.get('/books/add-to-cart/:id', async (req, res) => {
    const book = await Book.findById(req.params.id);

    if (!book) {
        return res.redirect('/books');
    }

    const cartItems = app.locals.cart || [];
    const existingItem = cartItems.find(item => item._id.toString() === book._id.toString());

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cartItems.push({ ...book.toObject(), quantity: 1 });
    }

    app.locals.cart = cartItems;
    res.redirect('/cart');
});

app.get('/cart', (req, res) => {
    const cartItems = app.locals.cart || [];
    const total = cartItems.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity || 1)), 0);

    res.render('cart', { cartItems, total });
});

app.get('/cart/remove/:id', (req, res) => {
    const cartItems = app.locals.cart || [];
    app.locals.cart = cartItems.filter(item => item._id.toString() !== req.params.id);
    res.redirect('/cart');
});

app.get('/cart/decrease/:id', (req, res) => {
    const cartItems = app.locals.cart || [];
    const item = cartItems.find(book => book._id.toString() === req.params.id);

    if (!item) {
        return res.redirect('/cart');
    }

    if (item.quantity > 1) {
        item.quantity -= 1;
    } else {
        app.locals.cart = cartItems.filter(book => book._id.toString() !== req.params.id);
    }

    app.locals.cart = cartItems;
    res.redirect('/cart');
});

app.get('/books/edit/:id', async (req, res) => {
    const book = await Book.findById(req.params.id);
    if (!book) {
        return res.redirect('/books');
    }

    res.render('editbook', { book });
});

app.post('/books/edit/:id', async (req, res) => {
    const { name, title, author, price, category, image } = req.body;

    const updatedData = {
        name: name || title,
        title: title || name,
        author,
        price: Number(price),
        category,
    };

    if (image && image.trim()) {
        updatedData.image = image.trim();
    }

    await Book.findByIdAndUpdate(req.params.id, updatedData, { new: true });
    res.redirect('/books');
});

app.get('/category', async (req, res) => {
    const books = await Book.find();
    const allBooks = await Book.find();
    const categoriesList = [...new Set(allBooks.map(book => book.category))];
    res.render('categories', { books, category: 'All', categories: categoriesList });
});

app.get('/category/:category', async (req, res) => {
    const category = req.params.category;
    const escapedCategory = category.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const books = await Book.find({
        category: { $regex: `^${escapedCategory}$`, $options: 'i' }
    });
    const allBooks = await Book.find();
    const categoriesList = [...new Set(allBooks.map(book => book.category))];
    res.render('categories', { books, category, categories: categoriesList });
});
app.get('/contact',(req,res)=>{
    const success = req.query.success === '1';
    const error = req.query.error === '1';
    res.render('contact', { success, error });
})
app.post('/contact', (req, res) => {
    const name = req.body.name;
    const email = req.body.email;
    const mobile = req.body.mob;
    const message = req.body.message;
    const cartItems = app.locals.cart || [];

    const cartHtml = cartItems.length
        ? cartItems.map(item => {
            const imagePath = item.image ? path.join(__dirname, 'public', item.image) : null;
            const safeName = escapeHtml(item.name || item.title || 'Book');
            const safePrice = escapeHtml(item.price || 0);
            const safeCategory = escapeHtml(item.category || 'Uncategorized');

            return `
                <div style="display: flex; align-items: center; gap: 16px; border: 1px solid #e0e0e0; border-radius: 12px; padding: 14px; margin: 12px 0; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    ${imagePath ? `<img src="cid:book-${String(item._id)}" alt="${safeName}" style="width: 90px; height: 90px; object-fit: contain; border-radius: 8px; background: #f7f7f7;" />` : ''}
                    <div>
                        <div style="font-size: 18px; font-weight: 700; color: #1f1f1f; margin-bottom: 4px;">${safeName}</div>
                        <div style="font-size: 14px; color: #555; margin-bottom: 4px;">Category: ${safeCategory}</div>
                        <div style="font-size: 15px; color: #1f1f1f; font-weight: 600;">Price: ₹${safePrice}</div>
                    </div>
                </div>
            `;
        }).join('')
        : '<p style="margin: 0; color: #666;">No books selected.</p>';

    const attachments = cartItems
        .filter(item => item.image)
        .map(item => ({
            filename: path.basename(item.image),
            path: path.join(__dirname, 'public', item.image),
            cid: `book-${String(item._id)}`
        }));

    transport.sendMail({
        to: 'adarshgiriag2006@gmail.com',
        subject: 'New Customer Message',
        html: `
            <div style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 24px; color: #111;">
                <div style="max-width: 700px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #e7e7e7;">
                    <div style="background: linear-gradient(135deg, #202124, #3c4043); color: #fff; padding: 20px 24px; font-size: 24px; font-weight: 700;">
                        New Customer Message
                    </div>

                    <div style="padding: 22px 24px 8px;">
                        <div style="margin-bottom: 14px;"><strong>Name:</strong> ${escapeHtml(name)}</div>
                        <div style="margin-bottom: 14px;"><strong>Email:</strong> ${escapeHtml(email)}</div>
                        <div style="margin-bottom: 14px;"><strong>Mobile:</strong> ${escapeHtml(mobile)}</div>
                        <div style="margin-bottom: 18px;"><strong>Message:</strong> ${escapeHtml(message)}</div>
                    </div>

                    <div style="padding: 0 24px 24px;">
                        <div style="font-size: 18px; font-weight: 700; margin-bottom: 10px; color: #1f1f1f;">Books in Cart</div>
                        ${cartHtml}
                    </div>
                </div>
            </div>
        `,
        attachments
    }, (error, info) => {
        if (error) {
            console.log(error);
            return res.redirect('/contact?error=1');
        }

        app.locals.cart = [];
        return res.redirect('/contact?success=1');
    });
});

app.post('/books/delete/:id', async (req, res) => {
    const bookId = req.params.id;
    await Book.findByIdAndDelete(bookId);
    res.redirect('/books');
});


app.listen(PORT,()=>{
    console.log("Listening on "+PORT)
})




// http://localhost:3000 --- run chrome
// E:\Node\Book Store> ---node index.js



