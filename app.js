const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const mysql = require('mysql2');
const app = express();
app.use(express.json());
const {jwt,authenticate,authorize}= require("./authentication")

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'sales_db'
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Connected to MySQL database.');
});

const upload = multer({ dest: 'uploads/' });


app.post('/upload-sales',authenticate,authorize, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const filePath = req.file.path;
    const results = [];
    const invalidRows = [];

    fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
            if (
                row['Transaction ID'] &&
                row['Customer Name'] &&
                row['Product'] &&
                row['Quantity'] &&
                row['Price'] &&
                row['Transaction Date']
            ) {
                const transactionDate = new Date(row['Transaction Date']);
                if (!isNaN(transactionDate)) {
                    row['Transaction Date'] = transactionDate;
                    row['Total Amount'] = parseFloat(row['Quantity']) * parseFloat(row['Price']);
                    results.push(row);
                } else {
                    invalidRows.push(row);
                }
            } else {
                invalidRows.push(row);
            }
        })
        .on('end', () => {
            const promises = results.map((transaction) => {
                return new Promise((resolve, reject) => {
                    db.query(
                        'SELECT * FROM Sales WHERE transaction_id = ?',
                        [transaction['Transaction ID']],
                        (err, rows) => {
                            if (err) return reject(err);

                            if (rows.length === 0) {
                                db.query(
                                    'INSERT INTO Sales (transaction_id, customer_name, product, quantity, price, transaction_date, total_amount) VALUES (?, ?, ?, ?, ?, ?, ?)',
                                    [
                                        transaction['Transaction ID'],
                                        transaction['Customer Name'],
                                        transaction['Product'],
                                        transaction['Quantity'],
                                        transaction['Price'],
                                        transaction['Transaction Date'],
                                        transaction['Total Amount']
                                    ],
                                    (err) => {
                                        if (err) return reject(err);
                                        resolve();
                                    }
                                );
                            } else {
                                resolve(); 
                            }
                        }
                    );
                });
            });

            Promise.all(promises)
                .then(() => {
                    fs.unlink(filePath, (err) => {
                        if (err) console.error('Error deleting uploaded file:', err);
                    });
                    res.json({
                        message: 'Upload complete.',
                        validRows: results.length,
                        invalidRows: invalidRows.length
                    });
                })
                .catch((err) => {
                    console.error('Error during database operation:', err);
                    res.status(500).send('An error occurred during the upload process.');
                });
        })
        .on('error', (err) => {
            console.error('Error reading CSV file:', err);
            res.status(500).send('An error occurred while reading the file.');
        });

    
        
});


app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const adminUser = { username: 'admin', password: 'admin' };

    if (username === adminUser.username && password === adminUser.password) {
        const token = jwt.sign({ User: 'admin' }, 'omm', { expiresIn: '1h' });
        return res.json({ token });
    }

    res.status(401).json({ error: 'Invalid credentials' });
});



const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
