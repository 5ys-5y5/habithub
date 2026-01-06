<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1xCM-cgbGsAL84kYoqrbgW-eKlpoin8sF

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deploy to Render

You can deploy as a static site using the included `render.yaml` blueprint:

1. Commit your code and push it to a Git repository that Render can access.
2. In Render, choose **Blueprint** and point it to this repository. The blueprint creates a **Static Site** service (`type: static` in `render.yaml`), so you do **not** need to select a Node environment manually.
3. Render will run `npm install && npm run build` and publish the contents of `dist/`.
4. Add an environment variable `GEMINI_API_KEY` in Render so the build can embed your key.