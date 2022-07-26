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
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  // page.setDefaultNavigationTimeout(0);
  page.setViewport({ width: 1320, height: 1000 });

  await page.goto("https://shef.com/shef/food-items/134415/");

  await page.type('[data-cy="login-email"]', SHEF_EMAIL);
  await page.type('[data-cy="login-password"]', SHEF_PASSWORD);

  await page.click('[data-cy="login-button"]');
  await page.waitForNavigation();

  await page.goto("https://shef.com/shef/food-items/134415/");

  await page.waitForSelector('[data-cy="snooze-add-address-button"]');
  await page.click('[data-cy="snooze-add-address-button"]');

  const dishes = [];

  let count = 0;

  page.on("response", async (response) => {
    if (
      response.url().includes("queries") &&
      response.headers()["content-type"] === "application/json; charset=UTF-8"
    ) {
      console.log(count++);

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

  await page.waitForSelector('input[type="text"]');

  await page.click("input.sc-kQEKhi.glQDVt", { clickCount: 3 });
  await page.type("input.sc-kQEKhi.glQDVt", "A");

  await page.waitForTimeout(4000);
  // await page.waitForResponse((response) => response.url().includes("queries"));
  // await page.waitForNetworkIdle();

  await page.evaluate(async () => {
    await document
      .querySelector("p.sc-DGxIM.iiHstv")
      .scrollIntoView({ behavior: "smooth", block: "end", inline: "end" });
  });

  try {
    console.log("Waiting for Button");
    await page.waitForSelector("button.sc-Fyfyc.gTCFHW.sc-kGHwda.cTBYrh", {
      timeout: 1500,
    });

    console.log("skipped button?");
  } catch (error) {
    console.log("NOT FOUND: ", error);
  }

  while (true) {
    try {
      if (await page.$("button.sc-Fyfyc.gTCFHW.sc-kGHwda.cTBYrh[disabled]")) {
        console.log("button disabled");
        break;
      } else {
        console.log("trying click?");
        await page.click("button.sc-Fyfyc.gTCFHW.sc-kGHwda.cTBYrh");
        await page.waitForTimeout(1000);
      }
    } catch (error) {
      console.log("ERROR: ", e);
      break;
    }
    // await page.waitForResponse((response) =>
    //   response.url().includes("queries")
    // );
  }

  // for (let i = 97; i <= 122; i++) {
  //   await page.click("input.sc-kQEKhi.glQDVt", { clickCount: 3 });
  //   await page.type("input.sc-kQEKhi.glQDVt", String.fromCharCode(i));

  //   try {
  //     await page.waitForSelector("button.sc-Fyfyc.kAGesh.sc-kGHwda.kTpxPz");
  //   } catch (error) {
  //     console.log("NOT FOUND: ", error);
  //   }
  //   while (true) {
  //     try {
  //       if (await page.$("button.sc-Fyfyc.kAGesh.sc-kGHwda.kTpxPz[disabled]")) {
  //         break;
  //       } else {
  //         await page.click("button.sc-Fyfyc.kAGesh.sc-kGHwda.kTpxPz");
  //         await page.waitForTimeout(1000);
  //       }
  //     } catch (error) {
  //       console.log("ERROR: ", e);
  //       break;
  //     }
  //     await page.waitForResponse((response) =>
  //       response.url().includes("queries")
  //     );
  //   }
  // }

  // console.log("Data Scraping Complete, Now Writing to Excel");

  // worksheet.addRows(dishes);

  // await workbook.xlsx.writeFile("dishes.xlsx");
  // console.log("Excel file written");

  // if (process.argv?.[2] === "--no-images")
  //   console.log("Skipping Image Download");
  // else {
  //   for (let dish of dishes) {
  //     await download(dish.imageUrl, `images/${dish.name}.jpg`);
  //   }
  //   console.log("Images saved");
  // }

  // await browser.close();
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
