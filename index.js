const puppeteer = require("puppeteer");
const fs = require("fs");
const https = require("https");

require("dotenv").config();
const ExcelJS = require("exceljs");

const workbook = new ExcelJS.Workbook();

const worksheet = workbook.addWorksheet("New Sheet", {
  properties: {
    defaultColWidth: 30,
  },
});
worksheet.columns = [
  { header: "Name", key: "name" },
  { header: "Description", key: "description" },
  { header: "Ingredients", key: "ingredients" },
  { header: "Image URL", key: "imageUrl" },
];

(async () => {
  console.log(process.argv);
  const { SHEF_EMAIL, SHEF_PASSWORD } = process.env;
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
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

  for (let i = 97; i <= 122; i++) {
    await page.click("input", { clickCount: 3 });
    await page.type("input", String.fromCharCode(i));

    for (let j = 0; j <= 124; j++) {
      try {
        console.log(`Letter ${String.fromCharCode(i)}, Page ${j}`);

        console.log('Clicking "Next"');

        await page.click(".sc-Fyfyc.gTCFHW.sc-VhGJa.DmPMx:last-child");
      } catch (e) {
        break;
      }
    }
    await page.waitForTimeout(1000);
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

  await browser.close();
})();

const download = async (url, destination) =>
  new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination);

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
  });
