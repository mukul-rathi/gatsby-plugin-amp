import React, { Fragment } from "react";
import { renderToString } from "react-dom/server";
import { JSDOM } from "jsdom";

const ampBoilerplate = `body{-webkit-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-moz-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-ms-animation:-amp-start 8s steps(1,end) 0s 1 normal both;animation:-amp-start 8s steps(1,end) 0s 1 normal both}@-webkit-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-moz-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-ms-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-o-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}`;
const ampNoscriptBoilerplate = `body{-webkit-animation:none;-moz-animation:none;-ms-animation:none;animation:none}`;

const interpolate = (str, map) =>
  str.replace(/{{\s*[\w\.]+\s*}}/g, match => map[match.replace(/[{}]/g, "")]);

export const onPreRenderHTML = (
  {
    getHeadComponents,
    replaceHeadComponents,
    getPreBodyComponents,
    replacePreBodyComponents,
    getPostBodyComponents,
    replacePostBodyComponents,
    pathname
  },
  {
    analytics,
    canonicalBaseUrl,
    components = [],
    excludedPaths = [],
    pathIdentifier
  }
) => {
  const headComponents = getHeadComponents();
  const preBodyComponents = getPreBodyComponents();
  const postBodyComponents = getPostBodyComponents();
  const isAmp = pathname.indexOf(pathIdentifier) > -1;
  if (isAmp) {
    const styles = headComponents.reduce((str, x) => {
      if (x.type === "style") {
        str += x.props.dangerouslySetInnerHTML.__html;
      }
      return str;
    }, "");
    replaceHeadComponents([
      <script async src="https://cdn.ampproject.org/v0.js" />,
      <style
        amp-boilerplate=""
        dangerouslySetInnerHTML={{ __html: ampBoilerplate }}
      />,
      <noscript>
        <style
          amp-boilerplate=""
          dangerouslySetInnerHTML={{ __html: ampNoscriptBoilerplate }}
        />
      </noscript>,
      <style amp-custom="" dangerouslySetInnerHTML={{ __html: styles }} />,
      ...components.map(x => (
        <script
          async
          custom-element={x}
          src={`https://cdn.ampproject.org/v0/${x}-0.1.js`}
        />
      )),
      analytics !== undefined ? (
        <script
          async
          custom-element="amp-analytics"
          src="https://cdn.ampproject.org/v0/amp-analytics-0.1.js"
        />
      ) : (
        <Fragment />
      ),
      ...headComponents.filter(x => x.type !== "style" && x.type !== "script")
    ]);
    replacePreBodyComponents([
      ...preBodyComponents.filter(x => x.key !== "plugin-google-tagmanager")
    ]);
    replacePostBodyComponents(
      postBodyComponents.filter(x => x.type !== "script")
    );
  } else if (excludedPaths.indexOf(pathname.replace(pathIdentifier, "")) < 0) {
    replaceHeadComponents([
      <link
        rel="amphtml"
        href={`${canonicalBaseUrl}${pathIdentifier.replace(
          /\//g,
          ""
        )}${pathname}`}
      />,
      ...headComponents
    ]);
  }
};

export const onRenderBody = (
  { setHeadComponents, setHtmlAttributes, setPreBodyComponents, pathname },
  { analytics, canonicalBaseUrl, pathIdentifier, useAmpClientIdApi = false }
) => {
  const isAmp = pathname.indexOf(pathIdentifier) > -1;
  if (isAmp) {
    setHtmlAttributes({ amp: "" });
    setHeadComponents([
      <link
        rel="canonical"
        href={`${canonicalBaseUrl}${pathname.replace(pathIdentifier, "")}`}
      />,
      useAmpClientIdApi ? (
        <meta name="amp-google-client-id-api" content="googleanalytics" />
      ) : (
        <Fragment />
      )
    ]);
    setPreBodyComponents([
      analytics != undefined ? (
        <amp-analytics
          type={analytics.type}
          data-credentials={analytics.dataCredentials}
          config={
            typeof analytics.config === "string" ? analytics.config : undefined
          }
        >
          {typeof analytics.config === "string" ? (
            <Fragment />
          ) : (
            <script
              type="application/json"
              dangerouslySetInnerHTML={{
                __html: interpolate(JSON.stringify(analytics.config), {
                  pathname
                })
              }}
            />
          )}
        </amp-analytics>
      ) : (
        <Fragment />
      )
    ]);
  }
};

export const replaceRenderer = (
  { bodyComponent, replaceBodyHTMLString, pathname },
  { pathIdentifier }
) => {
  const isAmp = pathname.indexOf(pathIdentifier) > -1;
  if (isAmp) {
    const bodyHTML = renderToString(bodyComponent);
    const dom = new JSDOM(bodyHTML);
    const document = dom.window.document;
    const images = [].slice.call(document.getElementsByTagName("img"));
    images.forEach(image => {
      const ampImage = document.createElement("amp-img");
      const attributes = Object.keys(image.attributes);
      const includedAttributes = attributes.map(key => {
        const attribute = image.attributes[key];
        ampImage.setAttribute(attribute.name, attribute.value);
        return attribute.name;
      });
      image.parentNode.replaceChild(ampImage, image);
    });
    replaceBodyHTMLString(document.documentElement.outerHTML);
  }
};