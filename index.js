require("dotenv").config();
const express = require("express");

const app = express();

const server = async () => {
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  app.use("/v1/query", require("./routes/query"));

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
};

server();
