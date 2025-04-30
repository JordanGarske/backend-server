import express from 'express';
import cors from 'cors';
import path from 'path';
import multer from "multer";
import fs from 'fs';
import {db,storage} from "./config/firebase.js";
import  {uploadBytes, ref as  storageRef, getDownloadURL,listAll,deleteObject,getMetadata } from "firebase/storage"
import { get, ref,remove, push } from "firebase/database";
import { fileURLToPath } from 'url';
import { fromBuffer } from "pdf2pic";
// const {initializeApp  } = require("firebase/app");

// app setting
const app = express()
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT ||8080;
const upload = multer({ storage:  multer.memoryStorage() }); 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase



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
app.get("/api/get/newsletter", async(req, res)=>{
  try{
    const listResult = await listAll(storageRef(storage, 'newletter-images/'));
    console.log(listResult.items.length);
    const newsList = new Array(listResult.items.length);

    const x = await Promise.all(
      listResult.items.map(async (itemRef) => {
        const [url, metadata] = await Promise.all([
          getDownloadURL(itemRef),
          getMetadata(itemRef),
        ]);

        const pageIndex = metadata.customMetadata?.page;
        if (pageIndex !== undefined) {
          newsList[pageIndex-1] = url;
        }

        return { name: itemRef.name, url };
      })
    );
    res.status(200).json(newsList);
  }
  catch (err) {
    console.error("Error uploading file", err);
    res.status(500).json({ error: "get pdf failed" });
  }

})
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
const options = {
  density: 100,
  saveFilename: "untitled",
  savePath: "./images",
  format: "png",
  width: 600,
  height: 600
};

app.post("/api/post/pdf", upload.single('file'), async (req, res) => {
  const file = req.file;

  try {
    if (file.mimetype !== 'application/pdf') {
      return res.status(500).json({ error: "Not a PDF file" });
    }

    // Delete all files in Firebase storage under 'newletter-images/'
    const listRef = storageRef(storage, 'newletter-images/');
    const { items } = await listAll(listRef);
    await Promise.all(items.map(item => deleteObject(item)));

    const imgs = await fromBuffer(file.buffer, options);
    const pngs = await imgs.bulk(-1, { responseType: "image" });

    for (const png of pngs) {
      const sRef = storageRef(storage, 'newletter-images/' + png.name);
      const buffer = fs.readFileSync(png.path);
      const result = await uploadBytes(sRef, buffer, { 
        contentType: 'image/png',
        customMetadata: {
          'page': png.page,
        }
       });

      console.log(result.metadata.fullPath);
    }

    // Clean up local 'images' folder
    const imagesDir = path.resolve(__dirname, 'images');
    fs.readdir(imagesDir, (err, files) => {
      if (err) return console.error("Failed to list directory files:", err);
      files.forEach((file) => {
        const filePath = path.join(imagesDir, file);
        fs.unlink(filePath, (err) => {
          if (err) {
            console.error(`Failed to delete file ${filePath}:`, err);
          } else {
            console.log(`Deleted file: ${filePath}`);
          }
        });
      });
    });

    res.status(200).json(newsList);

  } catch (err) {
    console.error("Error uploading file", err);
    res.status(500).json({ error: "Upload pdf failed" });
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