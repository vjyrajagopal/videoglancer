const puppeteer = require("puppeteer");
const fs = require("fs");

(async () => {
  const captureData = [];
  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // 1시간 30분짜리 영상
    //await page.goto(`https://www.youtube.com/watch?v=o3ka5fYysBM&t=5s`, {
    //  waitUntil: "networkidle2",
    //});

    // 34분짜리 영상
    //await page.goto(`https://www.youtube.com/watch?v=OrxmtDw4pVI&t=5s`, {
    //  waitUntil: "networkidle2",
    //});

    // 1분 미만 영상
    //await page.goto(`https://www.youtube.com/watch?v=lg2zZRLQU1A&t=${5}s`, {
    //  waitUntil: "networkidle2",
    //});

    // 즉석 테스트
    //await page.goto(`https://www.youtube.com/watch?v=I8M3GjGxRNA&t=5s`, {
    //  waitUntil: "networkidle2",
    //});

    // 테스트
    await page.goto("https://www.youtube.com/watch?v=AUQRyl1SNcU&t=5", {
      waitUntil: "networkidle2",
    });

    // get video component
    await page.waitForSelector(".html5-main-video");
    const videoEle = await page.$(".html5-main-video");

    if ((await page.$(".paused-mode")) !== null) {
      await page.keyboard.press("k");
      await page.waitForTimeout(200);
    }

    // get video length
    const timeEle = await page.$(".ytp-bound-time-right");
    const lenText = await timeEle.evaluate((ele) => {
      return ele.innerHTML;
    }, timeEle);
    const lenArray = lenText.split(":");
    let videoLength;
    if (lenArray[0] === "0") {
      console.log("too short!");
      console.log(lenArray);
    } else if (lenArray.length == 2) {
      console.log("under 1 hour video");
      videoLength = lenArray[0];
    } else if (lenArray.length == 3) {
      console.log("over 1 hour video");
      videoLength = parseInt(lenArray[0], 10) * 60 + parseInt(lenArray[1], 10);
    } else {
      console.log("exeptional case");
    }

    // caption on
    const captionBtn = await page.$(".ytp-subtitles-button");
    const captionOn = await page.evaluate(
      (el) => el.getAttribute("aria-pressed"),
      captionBtn
    );
    if (captionOn == "false") {
      await captionBtn.click();
    }

    // full screep 버튼이 안눌린다..왜지.
    //const fullscreenBtn = await page.$(".ytp-fullscreen-button");
    //
    //await fullscreenBtn.click();

    // start screenshot
    for (let i = 0; i < videoLength; i++) {
      await page.waitForSelector(".buffering-mode", { hidden: true });

      try {
        await page.waitForFunction(
          `document.querySelector('.ytp-spinner') && document.querySelector('.ytp-spinner').style.display=='none'`
        );
      } catch (e) {
        console.log("스피너 대기하는곳에서 에러발생");
      }

      // ad skip
      try {
        while ((await page.$(".ad-showing")) !== null) {
          await page.waitForSelector(".buffering-mode", { hidden: true });
          if ((await page.$(".paused-mode")) !== null) {
            await page.keyboard.press("k");
          }
          await page.waitForTimeout(6000);
          //await page.waitForSelector(".ytp-ad-skip-button");
          if ((await page.$(".ytp-ad-skip-button")) !== null) {
            const skipButton = await page.$(".ytp-ad-skip-button");
            await skipButton.click();
          }
        }
      } catch (e) {
        console.log("광고 스킵하는 부분에서 에러발생");
      }

      await page.waitForSelector(".buffering-mode", { hidden: true });

      // close overlay ad
      try {
        if ((await page.$(".ytp-ad-overlay-close-button")) !== null) {
          const adCloseBtns = await page.$$(".ytp-ad-overlay-close-button");
          await adCloseBtns[adCloseBtns.length - 1].click();
        }
      } catch (e) {
        console.log("오버레이 광고 끄는 부분에서 에러 발생");
      }

      try {
        if ((await page.$(".playing-mode")) !== null) {
          await page.keyboard.press("k");
          await page.waitForTimeout(200);
        }
      } catch (e) {
        console.log("플레잉 모드인거 재생멈춤 하는데서 에러발생");
      }

      // take screenshot
      // screenshot 대신 canvas 로 그려서 base64 문자열을 리턴할까. s3 이용하기 싫은데.
      // 아래 canvas 이용하는 방식은 자막이 안찍히네.
      // 자막도 따로 get 해서 json 에 집어넣어야겠는걸.

      await page.waitForSelector(".buffering-mode", { hidden: true });
      captureData.push(
        await page.evaluate((video) => {
          var scale = 1;
          var canvas = document.createElement("canvas");
          canvas.width = video.videoWidth * scale;
          canvas.height = video.videoHeight * scale;
          canvas
            .getContext("2d")
            .drawImage(video, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL("image/jpeg", 0.5);
        }, videoEle)
      );

      //await videoEle.screenshot({
      //  path: `results/${i}_${Date.now()}.jpeg`,
      //  type: "jpeg",
      //});

      // move to next time
      await page.keyboard.press("l");
      await page.keyboard.press("l");
      await page.keyboard.press("l");
      await page.keyboard.press("l");
      await page.keyboard.press("l");
      await page.keyboard.press("l");
      await page.waitForTimeout(200);
      await page.waitForSelector(".buffering-mode", { hidden: true });
      try {
        await page.waitForFunction(
          `document.querySelector('.ytp-spinner') && document.querySelector('.ytp-spinner').style.display=='none'`
        );
      } catch (e) {
        console.log("맨 마지막 스피너 기다리는데서 에러발생");
      }
      try {
        await page.waitForFunction(
          `document.querySelector('.ytp-bezel-text-hide') && document.querySelector('.ytp-bezel-text-hide').style.display=='none'`
        );
      } catch (e) {
        console.log("맨 마지막 화살표 없어지는거 기다리는데서 에러발생");
      }
    }

    // all done. close browser.
    //for (let j = 0; j < captureData.length; j++) {
    //  fs.writeFile(
    //    `${Date.now()}.png`,
    //    captureData[j],
    //    "base64",
    //    function (err) {
    //      console.log(err);
    //    }
    //  );
    //}

    //fs.writeFile("out.txt", captureData[0], (err) => {});
    //console.log(captureData[captureData.length - 1]);
    await browser.close();
    return captureData;
  } catch (e) {
    console.log(e);
  }
})();
