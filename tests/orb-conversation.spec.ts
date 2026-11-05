import { test, expect } from '@playwright/test';
test('orb responds to measured Web Audio and keeps a spoken clarification accessible when chat is minimized (offline transport)', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/config', (r) =>
    r.fulfill({
      json: { configured: true, authenticated: true, voiceConfigured: true },
    }),
  );
  await page.route('**/api/voice', (r) =>
    r.fulfill({ contentType: 'application/sdp', body: 'v=0\r\ns=offline\r\n' }),
  );
  await page.route('**/api/plan', (r) =>
    r.fulfill({
      json: {
        intent: 'clarify',
        message: 'Should the courtyard be open to the sky?',
        operations: [],
      },
    }),
  );
  await page.addInitScript(() => {
    let stream: MediaStream;
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async () => {
        const ctx = new AudioContext(),
          osc = ctx.createOscillator(),
          gain = ctx.createGain(),
          dest = ctx.createMediaStreamDestination();
        gain.gain.value = 0.1;
        osc.connect(gain);
        gain.connect(dest);
        osc.start();
        await ctx.resume();
        stream = dest.stream;
        (window as any).testAudio = { ctx, osc };
        return stream;
      },
    });
    class Peer {
      iceGatheringState = 'complete';
      connectionState = 'connected';
      localDescription = { sdp: 'v=0\r\ns=offline\r\n' };
      ontrack: any;
      onconnectionstatechange: any;
      channel = {
        readyState: 'open',
        onopen: null as any,
        onmessage: null as any,
        send() {},
        close() {},
      };
      addTrack() {}
      createDataChannel() {
        (window as any).voiceEvents = this.channel;
        return this.channel;
      }
      async createOffer() {
        return this.localDescription;
      }
      async setLocalDescription() {}
      async setRemoteDescription() {
        this.ontrack?.({ streams: [stream] });
        this.channel.onopen?.();
        this.channel.onmessage?.({
          data: JSON.stringify({ type: 'output_audio_buffer.started' }),
        });
      }
      close() {
        (window as any).testAudio?.osc.stop();
        void (window as any).testAudio?.ctx.close();
      }
    }
    (window as any).RTCPeerConnection = Peer;
  });
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
  await page.getByRole('button', { name: 'Minimize conversation' }).click();
  const dock = page.getByLabel('Atelier voice companion');
  await expect(dock).toBeVisible();
  await dock.getByRole('button', { name: 'Start voice conversation' }).click();
  await expect(dock).toContainText('Speaking');
  await expect
    .poll(async () =>
      Number(await dock.locator('.audio-orb').getAttribute('data-audio-level')),
    )
    .toBeGreaterThan(0.1);
  await page.evaluate(() =>
    (window as any).voiceEvents.onmessage({
      data: JSON.stringify({
        type: 'response.function_call_arguments.done',
        name: 'design',
        call_id: 'question',
        arguments: JSON.stringify({
          instruction: 'Create a courtyard building.',
        }),
      }),
    }),
  );
  await expect(
    page.getByRole('dialog', { name: 'Atelier question' }),
  ).toContainText('open to the sky');
  await expect(page.getByLabel('Answer Atelier')).toBeVisible();
  await page.screenshot({
    path: 'test-results/atelier-orb-question-phone.png',
  });
  await dock.getByRole('button', { name: 'Stop voice conversation' }).click();
  await expect(
    dock.getByRole('button', { name: 'Start voice conversation' }),
  ).toBeVisible();
  await dock.getByRole('button', { name: 'Open conversation' }).click();
  await expect(
    page.getByRole('textbox', { name: 'Message Atelier' }),
  ).toBeVisible();
});
