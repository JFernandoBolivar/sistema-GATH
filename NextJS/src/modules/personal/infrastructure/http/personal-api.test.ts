import { beforeEach, describe, expect, it, vi } from "vitest";

const { post, postForm } = vi.hoisted(() => ({
  post: vi.fn(),
  postForm: vi.fn(),
}));

vi.mock("@/shared/infrastructure/http/fetcher-api", () => ({
  apiClient: { post, postForm },
}));

import { personalApi } from "./personal-api";

describe("personalApi.subirFoto", () => {
  beforeEach(() => {
    post.mockReset();
    postForm.mockReset();
  });

  it("envía el FormData como multipart (postForm), no como JSON", async () => {
    const formData = new FormData();
    formData.append("file", new File(["foto"], "foto.png", { type: "image/png" }));
    postForm.mockResolvedValue({
      data: { clave: "perfiles/x.png", url: "/foto", mensaje: "ok" },
    });

    const resultado = await personalApi.subirFoto("12345678", formData);

    expect(post).not.toHaveBeenCalled();
    expect(postForm).toHaveBeenCalledTimes(1);
    expect(postForm).toHaveBeenCalledWith("/api/v1/personal/12345678/foto/", formData);
    expect(resultado.clave).toBe("perfiles/x.png");
  });
});
