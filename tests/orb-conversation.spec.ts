import { test, expect } from '@playwright/test';
test('orb keeps voice modeling and follow-up edits in the minimized workspace (offline transport)', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/config', (r) =>
    r.fulfill({
      json: {
        configured: true,
        authenticated: true,
        voiceConfigured: true,
        agentConfigured: true,
      },
    }),
  );
  await page.route('**/api/voice', (r) =>
    r.fulfill({ contentType: 'application/sdp', body: 'v=0\r\ns=offline\r\n' }),
  );
  let calls = 0;
  let createdId = '';
  await page.route('**/api/plan', (r) => {
    const body = r.request().postDataJSON();
    calls++;
    if (calls === 1)
      return r.fulfill({
        json: {
          intent: 'clarify',
          message: 'Should the courtyard be open to the sky?',
          operations: [],
        },
      });
    const finish = body.execution?.receipts.length > 0;
    if (finish) {
      const part = body.scene.objects.find(
        (o: any) => o.name === 'Courtyard study',
      );
      expect(part).toBeTruthy();
      if (!createdId) createdId = part.id;
      else expect(part.id).toBe(createdId);
      return r.fulfill({
        json: {
          intent: 'finish',
          message: 'Your study is ready.',
          operations: [],
          brief: null,
          planning: null,
        },
      });
    }
    return r.fulfill({
      json: {
        intent: 'apply',
        message: 'Develop the study',
        brief: null,
        planning: { stage: 'Model', assumptions: [], next: 'Check geometry' },
        operations: createdId
          ? [
              {
                type: 'move',
                targets: [createdId],
                direction: 'up',
                distance: 2,
              },
            ]
          : [
              {
                type: 'create_at',
                name: 'Courtyard study',
                shape: 'box',
                width: 6,
                depth: 4,
                height: 3,
                x: 12,
                y: 0,
                z: 0,
                rotation: 0,
              },
            ],
      },
    });
  });
  await page.addInitScript(() => {
    let stream: MediaStream;
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async () => {
        (window as any).micStarts = ((window as any).micStarts ?? 0) + 1;
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
        send(data: string) {
          ((window as any).sentVoiceEvents ??= []).push(JSON.parse(data));
        },
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
  await dock.getByRole('button', { name: 'Voice orb' }).click();
  await expect(dock).toContainText('Speaking');
  await expect(
    page.getByRole('textbox', { name: 'Message Atelier' }),
  ).not.toBeVisible();
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
  await expect(dock).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: 'Message Atelier' }),
  ).not.toBeVisible();
  await page.screenshot({
    path: 'test-results/atelier-orb-question-phone.png',
  });
  const speak = (call_id: string, instruction: string) =>
    page.evaluate(
      ({ call_id, instruction }) =>
        (window as any).voiceEvents.onmessage({
          data: JSON.stringify({
            type: 'response.function_call_arguments.done',
            name: 'design',
            call_id,
            arguments: JSON.stringify({ instruction }),
          }),
        }),
      { call_id, instruction },
    );
  await speak(
    'answer',
    'Yes. Start with a simple six by four metre mass, three metres high.',
  );
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '3',
    { timeout: 30000 },
  );
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            ((window as any).sentVoiceEvents ?? [])
              .filter((e: any) => e.item?.type === 'function_call_output')
              .at(-1)?.item.output,
        ),
      { timeout: 30000 },
    )
    .toBe('Your study is ready.');
  await expect(dock).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: 'Message Atelier' }),
  ).not.toBeVisible();
  await speak('followup', 'Raise that new study by two metres.');
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            JSON.parse(
              localStorage.getItem('atelier.session.v2')!,
            ).project.volumes.find((v: any) => v.name === 'Courtyard study')
              ?.position.y,
        ),
      { timeout: 30000 },
    )
    .toBe(2);
  await expect.poll(() => calls).toBe(5);
  await expect(dock).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: 'Message Atelier' }),
  ).not.toBeVisible();
  await dock.getByRole('button', { name: 'Voice orb' }).click();
  await expect(dock.getByRole('button', { name: 'Voice orb' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await dock.getByRole('button', { name: 'Voice orb' }).dblclick();
  await expect
    .poll(() => page.evaluate(() => (window as any).micStarts))
    .toBe(1);
  await expect(
    page.getByRole('textbox', { name: 'Message Atelier' }),
  ).toBeVisible();
});
