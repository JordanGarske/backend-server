const express =require("express");
const cors = require("cors");
const path = require("path");
const app = express();
const { get, ref,remove, push, onValue } = require("firebase/database");
const { db } = require("./config/firebase.js");
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT ||8080;

app.listen(PORT, () =>console.log("Server started" + PORT))
//get request
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
app.post("/api/send", async (req, res) => {     

  try {
    const snapshot = push(ref(db, 'dates/' ), req.body);
    res.json(snapshot);
  } catch (error) {
    console.error("Error fetching calendar data:", error);
    res.status(500).json({ error: "Failed to fetch calendar data" });
  }
})
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
// sets all routes for react router frontend
app.use(express.static(path.join(__dirname, "./dist")))

app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(__dirname, "./dist/index.html"));
});




// const userRef = ref(db, 'dates/');
// onValue(userRef, (snapshot) => {
//     const data = snapshot.val();
//     const keys = Object.keys(data);
//     const dates = []
//     keys.forEach(key => {
//       const date = data[key];
//       date['id'] = key;
//       dates.push(date)
//     });
//     setData(dates)
//     setLoading(false);
//   })