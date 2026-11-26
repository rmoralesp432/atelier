import { test, expect } from '@playwright/test';
import { criteria, measure, selector } from './fixtures/completion';
test('orb keeps voice modeling and follow-up edits in the minimized workspace (offline transport)', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
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
  await page.route('**/api/completion-criteria', (r) => {
    const b = r.request().postDataJSON();
    const existing = b.scene.objects.find(
      (o: any) => o.name === 'Courtyard study',
    );
    const chosen = selector(existing ? [existing.id] : ['$new']);
    return r.fulfill({
      json: criteria(
        [
          measure('count', 'count', 1, chosen),
          measure('height', 'height', 3, chosen),
          measure('width', 'width', 6, chosen),
          measure('depth', 'depth', 4, chosen),
          measure('base', 'y', existing ? 2 : 0, chosen),
        ],
        existing ? [existing.id] : [],
        b.message,
      ),
    });
  });
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
    let playback: MediaStream;
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async () => {
        (window as any).micStarts = ((window as any).micStarts ?? 0) + 1;
        const ctx = new AudioContext();
        const signal = (amplitude: number) => {
          const osc = ctx.createOscillator(),
            gain = ctx.createGain(),
            dest = ctx.createMediaStreamDestination();
          gain.gain.value = amplitude;
          osc.connect(gain);
          gain.connect(dest);
          osc.start();
          return { osc, gain, stream: dest.stream };
        };
        const input = signal(0),
          output = signal(0.1);
        await ctx.resume();
        stream = input.stream;
        // Independent audio lets us prove each side drives the visible orb,
        // including playback while half-duplex capture disables the mic.
        playback = output.stream;
        (window as any).voiceStream = stream;
        (window as any).testAudio = { ctx, input, output };
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
          const event = JSON.parse(data);
          ((window as any).sentVoiceEvents ??= []).push(event);
          if (event.type === 'response.create')
            queueMicrotask(() => {
              for (const type of [
                'response.created',
                'output_audio_buffer.started',
                'response.done',
                'output_audio_buffer.stopped',
              ])
                this.onmessage?.({ data: JSON.stringify({ type }) });
            });
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
        this.ontrack?.({ streams: [playback] });
        this.channel.onopen?.();
        this.channel.onmessage?.({
          data: JSON.stringify({ type: 'output_audio_buffer.started' }),
        });
      }
      close() {
        playback?.getTracks().forEach((track) => track.stop());
        (window as any).testAudio?.input.osc.stop();
        (window as any).testAudio?.output.osc.stop();
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
  expect(
    await page.evaluate(
      () => (window as any).voiceStream.getTracks()[0].enabled,
    ),
  ).toBe(false); // Generated input has no AEC; output must still animate the orb.
  await expect(
    page.getByRole('textbox', { name: 'Message Atelier' }),
  ).not.toBeVisible();
  await expect
    .poll(async () =>
      Number(await dock.locator('.audio-orb').getAttribute('data-audio-level')),
    )
    .toBeGreaterThan(0.1);
  const orb = dock.locator('.audio-orb');
  const visibleScale = () =>
    orb.evaluate(
      (el) =>
        el.getBoundingClientRect().width / (el as HTMLElement).offsetWidth,
    );
  const setLevel = (channel: 'input' | 'output', amplitude: number) =>
    page.evaluate(
      ({ channel, amplitude }) => {
        (window as any).testAudio[channel].gain.gain.value = amplitude;
      },
      { channel, amplitude },
    );
  // Visible output motion, not merely a changing diagnostic level.
  await expect.poll(visibleScale).toBeGreaterThan(1.15);
  await expect
    .poll(() =>
      orb.locator('.orb-response').evaluate((el) => {
        const m = (el as SVGGElement).transform.baseVal.consolidate()!.matrix;
        return Math.abs(Math.hypot(m.a, m.b) - Math.hypot(m.c, m.d));
      }),
    )
    .toBeGreaterThan(0.03);
  await page.screenshot({
    path: 'test-results/atelier-orb-speaking-phone.png',
  });
  await setLevel('output', 0);
  await expect.poll(visibleScale).toBeLessThan(1.02);
  await page.evaluate(() =>
    (window as any).voiceEvents.onmessage({
      data: JSON.stringify({ type: 'output_audio_buffer.stopped' }),
    }),
  );
  await expect(dock).toContainText('Listening');
  await setLevel('input', 0.1);
  await expect.poll(visibleScale).toBeGreaterThan(1.15);
  await dock.getByRole('button', { name: 'Mute microphone' }).click();
  await expect.poll(visibleScale).toBeLessThan(1.02);
  await dock.getByRole('button', { name: 'Unmute microphone' }).click();
  await expect.poll(visibleScale).toBeGreaterThan(1.15);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(visibleScale).toBeCloseTo(1, 2);
  await expect
    .poll(async () => Number(await orb.getAttribute('data-audio-level')))
    .toBeGreaterThan(0.1); // Measurement continues without forced movement.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(visibleScale).toBeGreaterThan(1.15);
  await setLevel('input', 0);
  await expect.poll(visibleScale).toBeLessThan(1.02);
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
  // Typing a clarification must leave mute/end available above an iOS-style keyboard.
  await page.getByLabel('Answer Atelier').focus();
  await page.evaluate(() => {
    Object.defineProperty(visualViewport, 'height', {
      configurable: true,
      get: () => 430,
    });
    visualViewport!.dispatchEvent(new Event('resize'));
  });
  await expect(page.locator('html')).toHaveAttribute('data-phone-keyboard', '');
  await expect(
    dock.getByRole('button', { name: 'Mute microphone' }),
  ).toBeVisible();
  const voiceBounds = (await dock.boundingBox())!;
  expect(voiceBounds.y + voiceBounds.height).toBeLessThanOrEqual(430);
  await page.evaluate(() => {
    delete (visualViewport as any).height;
    (document.activeElement as HTMLElement)?.blur();
    visualViewport!.dispatchEvent(new Event('resize'));
  });
  await expect(page.locator('html')).not.toHaveAttribute('data-phone-keyboard');
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
    .toContain('Completed; measurable checks passed.');
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
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          ((window as any).sentVoiceEvents ?? []).filter(
            (e: any) => e.type === 'response.create',
          ).length,
      ),
    )
    .toBe(3);
  await expect(dock).toContainText('Listening');
  await dock.getByRole('button', { name: 'Mute microphone' }).click();
  expect(
    await page.evaluate(() =>
      (window as any).voiceStream
        .getTracks()
        .every((t: MediaStreamTrack) => !t.enabled),
    ),
  ).toBe(true);
  await dock.getByRole('button', { name: 'Unmute microphone' }).click();
  expect(
    await page.evaluate(() =>
      (window as any).voiceStream
        .getTracks()
        .every((t: MediaStreamTrack) => t.enabled),
    ),
  ).toBe(true);
  await dock.getByRole('button', { name: 'Voice orb' }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).voiceStream
          .getTracks()
          .every((t: MediaStreamTrack) => t.readyState === 'ended'),
      ),
    )
    .toBe(true);
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
