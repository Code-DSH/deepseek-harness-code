import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { expect, test } from "@playwright/test";

test("shows first-launch dependency installation progress", async ({
  page,
}) => {
  await page.goto(
    pathToFileURL(
      join(process.cwd(), "apps/desktop/src/dependency-install.html"),
    ).href,
  );

  await expect(page.getByText("首次启动需要安装依赖，请稍候。")).toBeVisible();
  await expect(
    page.getByText("预计需要 5–10 分钟，具体取决于网络速度。"),
  ).toBeVisible();
  await expect(
    page.getByRole("progressbar", { name: "正在安装依赖" }),
  ).toBeVisible();
});
