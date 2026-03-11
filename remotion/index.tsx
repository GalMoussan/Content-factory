// @ts-nocheck — Bundled by Remotion's webpack, not by project tsc
import React from 'react';
import { registerRoot, Composition } from 'remotion';
import { ContentVideo } from './ContentVideo';

const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="ContentVideo"
        component={ContentVideo}
        durationInFrames={30 * 60}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          sections: [],
          narrationPath: '',
        }}
      />
    </>
  );
};

registerRoot(RemotionRoot);
