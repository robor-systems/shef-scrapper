const puppeteer = require("puppeteer");

require("dotenv").config();
const ExcelJS = require("exceljs");

const workbook = new ExcelJS.Workbook();

const worksheet = workbook.addWorksheet("New Sheet", {
  properties: {
    defaultColWidth: 30,
  },
});
worksheet.columns = [
  { header: "Title", key: "title" },
  { header: "Description", key: "description" },
  { header: "Recipe", key: "recipe" },
  { header: "Image URL", key: "imageUrl" },
];

(async () => {
  const { SHEF_EMAIL, SHEF_PASSWORD } = process.env;
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
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

  for (let i = 97; i <= 98; i++) {
    await page.click("input", { clickCount: 3 });
    await page.type("input", "a" || String.fromCharCode(1));

    for (let j = 0; j < 2; j++) {
      console.log(`Letter ${String.fromCharCode(i)}, Page ${j}`);
      const items = await page.$$(".sc-eHdiCg.jFpQEY");

      const newDishes = (
        await Promise.all(
          items.map((item) =>
            Promise.all([
              item.$eval(".sc-wQkWr.kawync", (item) => item.textContent),
              item.$(".sc-dFJsGO.hDHoJH.sc-jwBoPJ.hGjGKn"),
              item.$$eval(".sc-uGIhk.dEeFET", (item) =>
                item.map((i) => i.textContent)
              ),
            ])
          )
        )
      )
        .map((item) => ({
          title: item[0],
          description: item[2][0],
          recipe: item[2][1],
          imageUrl: item[1],
        }))
        .filter((item) => !dishes.find((dish) => dish.title === item.title));

      dishes.push(...newDishes);

      await page.click(".sc-Fyfyc.gTCFHW.sc-VhGJa.DmPMx:last-child");
      await page.waitForTimeout(1000);
    }
  }

  console.log("dishes", dishes);

  console.log("Data Scraping Complete, Now Writing to Excel");

  worksheet.addRows(dishes);

  await workbook.xlsx.writeFile("dishes.xlsx");

  console.log("Excel file written");

  await browser.close();
})();

const download = (url, destination) =>
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
