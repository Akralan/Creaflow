import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getBackgroundRemover, isBackgroundRemovalAvailable } from "./backgroundRemoval";
import { BackgroundRemovalError } from "./providers/photoroom";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  delete process.env.BACKGROUND_REMOVAL_PROVIDER;
  delete process.env.PHOTOROOM_API_KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getBackgroundRemover", () => {
  it("est absent sans variable d'environnement, ou avec un provider sans clé", () => {
    expect(isBackgroundRemovalAvailable()).toBe(false);
    expect(getBackgroundRemover()).toBeNull();
    process.env.BACKGROUND_REMOVAL_PROVIDER = "photoroom";
    expect(getBackgroundRemover()).toBeNull();
  });

  it("renvoie l'adaptateur Photoroom quand il est configuré", () => {
    process.env.BACKGROUND_REMOVAL_PROVIDER = "photoroom";
    process.env.PHOTOROOM_API_KEY = "sandbox_test";
    expect(isBackgroundRemovalAvailable()).toBe(true);
    expect(getBackgroundRemover()).not.toBeNull();
  });
});

describe("adaptateur Photoroom", () => {
  beforeEach(() => {
    process.env.BACKGROUND_REMOVAL_PROVIDER = "photoroom";
    process.env.PHOTOROOM_API_KEY = "sandbox_test";
  });

  it("envoie l'image en multipart avec la clé et renvoie les octets du PNG", async () => {
    const png = new Uint8Array([137, 80, 78, 71]);
    fetchMock.mockResolvedValue(new Response(png, { status: 200, headers: { "Content-Type": "image/png" } }));
    const out = await getBackgroundRemover()!.removeBackground(Buffer.from("jpeg-bytes"), "image/jpeg");
    expect([...out]).toEqual([...png]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://sdk.photoroom.com/v1/segment");
    expect(init.method).toBe("POST");
    expect(init.headers["x-api-key"]).toBe("sandbox_test");
    expect(init.body).toBeInstanceOf(FormData);
    const file = (init.body as FormData).get("image_file");
    expect(file).toBeInstanceOf(Blob);
    expect((file as Blob).type).toBe("image/jpeg");
  });

  it("lève une erreur explicite sur une réponse en échec", async () => {
    fetchMock.mockResolvedValue(new Response("quota exceeded", { status: 402 }));
    await expect(getBackgroundRemover()!.removeBackground(Buffer.from("x"), "image/png")).rejects.toBeInstanceOf(BackgroundRemovalError);
    await expect(getBackgroundRemover()!.removeBackground(Buffer.from("x"), "image/png")).rejects.toThrow("402");
  });
});
