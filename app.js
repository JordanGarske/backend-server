const express = require('express')
const cors = require("cors");
const path = require("path");

const multer = require("multer");
const {firebaseConfig} = require("./config/firebase.js")
const {uploadBytes, ref: storageRef, getStorage, getDownloadURL,listAll } = require("firebase/storage");
const {initializeApp  } = require("firebase/app");
const { get, ref,remove, push,getDatabase } = require("firebase/database");


const app = express()
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT ||8080;
const upload = multer({ storage:  multer.memoryStorage() }); 


// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp)
const storage = getStorage(firebaseApp);

//get
app.get("/api/calendar", async (req, res) => {
  try {
      const userRef = ref(db, 'dates/');
      const snapshot = await get(userRef);
      
      if (!snapshot.exists()) {
          return res.json([]);
      }

      const data = snapshot.val();
      const dates = Object.keys(data).map(key => ({
          ...data[key],
          id: key
      }));

      res.json(dates);
  } catch (error) {
      console.error("Error fetching calendar data:", error);
      res.status(500).json({ error: "Failed to fetch calendar data" });
  }
});

app.get("/api/photos", async (req, res) => {
  try {
    const listResult = await listAll(storageRef(storage, 'calendar-images/'));

    const items = await Promise.all(
      listResult.items.map(async (itemRef) => {
        const url = await getDownloadURL(itemRef);
        return { name: itemRef.name, url: url };
      })
    );

    res.status(200).json(items);
  } catch (err) {
    console.error("Error listing files", err);
    res.status(500).json({ error: "Listing photos failed" });
  }
});

app.post("/api/send", async (req, res) => {     

  try {
    const snapshot = push(ref(db, 'dates/' ), req.body)
    res.json(snapshot);
  } catch (error) {
    console.error("Error fetching calendar data:", error);
    res.status(500).json({ error: "Failed to fetch calendar data" });
  }
})

app.post("/api/photo",upload.single('file'),  async (req, res) => {
  const file = req.file
  try {
    const fileBuffer = file.buffer;
    const og = file.originalname;

    const sRef = storageRef(storage, 'calendar-images/'+og);
    const metadata = {
      contentType: file.mimetype // or 'image/png', etc.
    };
    const result = await uploadBytes(sRef, fileBuffer,metadata);
    const url = await getDownloadURL(sRef);

    listAll(storageRef(storage,'calendar-images/'))
    .then((listResult) => {
      listResult.items.forEach((itemRef) => {
        // Process each file
        console.log('File:', itemRef.name);
      });
    })
    res.status(200).json(file);
  } catch (err) {
    console.error("Error uploading file", err);
    res.status(500).json({ error: "Upload failed" });
  }

});

app.delete("/api/delete", async (req, res) => {     

  try {
    const userRef = ref(db, 'dates/'+ req.body.id); 
    const snapshot = await remove(userRef);

    res.json(snapshot);
  } catch (error) {
    console.error("Error fetching calendar data:", error);
    res.status(500).json({ error: "Failed to fetch calendar data" });
  }
})

app.use(express.static(path.join(__dirname, "./dist")))
app.listen(PORT, () =>{console.log("Server started" + PORT)})