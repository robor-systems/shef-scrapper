const puppeteer = require("puppeteer");
const fs = require("fs");
const https = require("https");

require("dotenv").config();
const ExcelJS = require("exceljs");
const { exit } = require("process");

const workbook = new ExcelJS.Workbook();
// const worksheet = workbook.addWorksheet("New Sheet", {
//   properties: {
//     defaultColWidth: 30,
//   },
// });
// worksheet.columns = [
//   { header: "Name", key: "name" },
//   { header: "Description", key: "description" },
//   { header: "Ingredients", key: "ingredients" },
//   { header: "Image URL", key: "imageUrl" },
// ];
async function downloadImages() {
  console.log("loading file");
  const dishContent = [];
  await workbook.xlsx.readFile("dishes_final.xlsx").then(async () => {
    console.log("getting worksheet");
    let worksheet = workbook.getWorksheet("New Sheet");
    try {
      // let count = 0;
      worksheet.eachRow((row, rowNum) => {
        dishContent.push(row.values);
      });

      console.log("ALL done, lenght: " + dishContent.length);

      for (let index = 2; index < dishContent.length; index++) {
        const element = dishContent[index];

        let name = element[1];
        name = name.replace(/\s/g, "_");
        let url = element[element.length - 1];
        console.log(name, url);

        await download(url, `images/${name}.jpg`);
        if (index == 10) break;
      }
    } catch (error) {
      console.log("ERROR: " + error);
    }
  });
}

(async () => {
  if (process.argv?.[2] === "--images") {
    await downloadImages();
    exit();
  }
  console.log(process.argv);
  const { SHEF_EMAIL, SHEF_PASSWORD } = process.env;
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  page.setViewport({ width: 1380, height: 1000 });
  page.setDefaultNavigationTimeout(0);

  await page.goto("https://shef.com/shef/food-items/134415/");

  await page.type('[data-cy="login-email"]', SHEF_EMAIL);
  await page.type('[data-cy="login-password"]', SHEF_PASSWORD);

  await page.click('[data-cy="login-button"]');
  await page.waitForNavigation();

  await page.goto("https://shef.com/shef/food-items/134415/");
  await page.waitForTimeout(2000);

  await page.click('[data-cy="snooze-add-address-button"]');
  await page.waitForTimeout(2000);

  const dishes = [];

  page.on("response", async (response) => {
    if (
      response.url().includes("queries") &&
      response.headers()["content-type"] === "application/json; charset=UTF-8"
    ) {
      console.log("adding data");
      dishes.push(
        ...(await response.json()).results[0].hits
          .filter((dish) => !dishes.find((item) => item.name === dish.name))
          .map((item) => ({
            name: item.name,
            description: item.description,
            ingredients: item.ingredients,
            imageUrl: item.imageUrl,
          }))
      );
    }
  });

  // await page.click("input", { clickCount: 3 });
  // await page.type("input", "A");

  // try {
  //   console.log(`Letter A, Page 1`);

  //   for (let index = 0; index < 125; index++) {
  //     console.log('Clicking "Next"');
  //     let elemExists = await page.$(
  //       "div.sc-gkZcHc.hAJCcO>button:last-child[disabled]"
  //     );
  //     console.log(elemExists);
  //     if (elemExists) {
  //       console.log("Breaking");
  //       break;
  //     }

  //     await page.click("div.sc-gkZcHc.hAJCcO>button:last-child");
  //     await page.waitForTimeout(200);
  //   }
  // } catch (e) {
  //   console.log("ERROR: ", e);
  // }

  for (let i = 97; i <= 122; i++) {
    await page.click("input", { clickCount: 3 });
    await page.type("input", String.fromCharCode(i));

    for (let j = 0; j <= 125; j++) {
      try {
        console.log(`Letter ${String.fromCharCode(i)}, Page ${j}`);
        console.log('Clicking "Next"');

        let elemExists = await page.$(
          "div.sc-gkZcHc.hAJCcO>button:last-child[disabled]"
        );
        if (elemExists) {
          console.log("Breaking");
          break;
        }

        await page.click("div.sc-gkZcHc.hAJCcO>button:last-child");
        await page.waitForTimeout(200);
      } catch (e) {
        console.log("ERROR: ", e);
        break;
      }
    }
    await page.waitForTimeout(500);
  }

  console.log("Data Scraping Complete, Now Writing to Excel");

  worksheet.addRows(dishes);

  await workbook.xlsx.writeFile("dishes.xlsx");
  console.log("Excel file written");

  if (process.argv?.[2] === "--no-images")
    console.log("Skipping Image Download");
  else {
    for (let dish of dishes) {
      await download(dish.imageUrl, `images/${dish.name}.jpg`);
    }
    console.log("Images saved");
  }

  console.log("Exiting");
  // await browser.close();
})();

const download = async (url, destination) =>
  new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination);
    try {
      https
        .get(url, (response) => {
          response.pipe(file);

          file.on("finish", () => {
            file.close(resolve(true));
          });
        })
        .on("error", (error) => {
          fs.unlink(destination);

          reject(error.message);
        });
    } catch (error) {
      console.log(error);
    }
  });
