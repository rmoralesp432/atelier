import { afterEach, expect, it, vi } from 'vitest';
import { VoiceConnection } from './client';

// Media and transport doubles: these verify lifecycle/tool routing, not live audio.
afterEach(() => vi.unstubAllGlobals());
function browser() {
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] };
  const channel = {
    readyState: 'open',
    send: vi.fn(),
    close: vi.fn(),
    onopen: null as any,
    onmessage: null as any,
  };
  const peer = {
    iceGatheringState: 'complete',
    connectionState: 'connected',
    localDescription: { sdp: 'v=0\r\ns=test-offer\r\n' },
    addTrack: vi.fn(),
    createDataChannel: () => channel,
    createOffer: vi.fn(async () => ({ type: 'offer', sdp: 'v=0\r\n' })),
    setLocalDescription: vi.fn(async () => {}),
    setRemoteDescription: vi.fn(async () => {}),
    close: vi.fn(),
  };
  const audio = {
    autoplay: false,
    srcObject: null,
    pause: vi.fn(),
    play: vi.fn(async () => {}),
  };
  const media = vi.fn(async () => stream);
  const transport = vi.fn(async () => new Response('v=0\r\ns=test-answer\r\n'));
  vi.stubGlobal('window', { isSecureContext: true });
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: media } });
  vi.stubGlobal(
    'RTCPeerConnection',
    class {
      constructor() {
        return peer;
      }
    },
  );
  vi.stubGlobal(
    'Audio',
    class {
      constructor() {
        return audio;
      }
    },
  );
  vi.stubGlobal('fetch', transport);
  return { track, stream, channel, peer, audio, media, transport };
}
it('routes continuous voice turns and spoken confirmation through one planner, ignores duplicate calls, and releases capture', async () => {
  const b = browser();
  const design = vi.fn(async (text: string) =>
    text.includes('Yes')
      ? 'Applied reviewed geometry.'
      : 'Review two floor slabs and a roof.',
  );
  const status = vi.fn();
  const voice = new VoiceConnection(design, status);
  await voice.start();
  b.channel.onopen();
  const send = (id: string, instruction: string) =>
    b.channel.onmessage({
      data: JSON.stringify({
        type: 'response.function_call_arguments.done',
        name: 'design',
        call_id: id,
        arguments: JSON.stringify({ instruction }),
      }),
    });
  send('first', 'Turn this into two floors with glass.');
  await vi.waitFor(() => expect(b.channel.send).toHaveBeenCalledTimes(2));
  send('first', 'Duplicate event should not edit.');
  send('second', 'Yes, apply that change.');
  await vi.waitFor(() => expect(b.channel.send).toHaveBeenCalledTimes(4));
  expect(design.mock.calls.map(([text]) => text)).toEqual([
    'Turn this into two floors with glass.',
    'Yes, apply that change.',
  ]);
  expect(JSON.parse(b.channel.send.mock.calls[2][0]).item.output).toBe(
    'Applied reviewed geometry.',
  );
  voice.stop();
  send('third', 'Must not edit after stopping.');
  expect(design).toHaveBeenCalledTimes(2);
  expect(b.track.stop).toHaveBeenCalledOnce();
  expect(b.peer.close).toHaveBeenCalledOnce();
  expect(b.channel.close).toHaveBeenCalledOnce();
  expect(b.audio.pause).toHaveBeenCalledOnce();
  expect(status).toHaveBeenLastCalledWith('Off');
});
it('stops a microphone granted after the user cancels, without opening a provider session', async () => {
  const b = browser();
  let grant!: (value: typeof b.stream) => void;
  b.media.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        grant = resolve;
      }),
  );
  const voice = new VoiceConnection(vi.fn(), vi.fn());
  const starting = voice.start();
  voice.stop();
  grant(b.stream);
  await starting;
  expect(b.track.stop).toHaveBeenCalledOnce();
  expect(b.transport).not.toHaveBeenCalled();
});
it('cleans up capture when the real backend rejects a voice session', async () => {
  const b = browser();
  b.transport.mockResolvedValueOnce(
    new Response(
      JSON.stringify({ error: 'Add API credits before using voice.' }),
      { status: 503 },
    ),
  );
  const voice = new VoiceConnection(vi.fn(), vi.fn());
  await expect(voice.start()).rejects.toThrow('Add API credits');
  expect(b.track.stop).toHaveBeenCalledOnce();
  expect(b.peer.setRemoteDescription).not.toHaveBeenCalled();
});
it('aborts an in-flight voice session request when stopped without reporting cancellation as a service failure', async () => {
  const b = browser();
  const transport = vi.fn(
    (_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal!.addEventListener('abort', () =>
          reject(new DOMException('Cancelled', 'AbortError')),
        );
      }),
  );
  vi.stubGlobal('fetch', transport);
  const voice = new VoiceConnection(vi.fn(), vi.fn());
  const starting = voice.start();
  await vi.waitFor(() => expect(transport).toHaveBeenCalledOnce());
  voice.stop();
  await expect(starting).resolves.toBeUndefined();
  expect(transport.mock.calls[0][1].signal!.aborted).toBe(true);
  expect(b.track.stop).toHaveBeenCalledOnce();
  expect(b.peer.setRemoteDescription).not.toHaveBeenCalled();
});
