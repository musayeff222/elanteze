export type MailTemplate = {
  subject: string;
  text: string;
  html: string;
};

function layout(title: string, body: string): string {
  return `<div style="font-family:Segoe UI,Tahoma,sans-serif;color:#17211c;line-height:1.5">
    <h2 style="color:#0b6243">${title}</h2>
    <p>${body}</p>
    <p style="color:#5d6b64;font-size:13px">ALVER komandası</p>
  </div>`;
}

export function verifyEmailTemplate(link: string): MailTemplate {
  return {
    subject: "ALVER e-poçt təsdiqi",
    text: `Hesabınızı təsdiqləmək üçün bu linkə keçin: ${link}`,
    html: layout("E-poçtunuzu təsdiqləyin", `Hesabınızı aktivləşdirmək üçün <a href="${link}">bu linkə</a> keçin.`),
  };
}

export function resetPasswordTemplate(link: string): MailTemplate {
  return {
    subject: "ALVER şifrə bərpası",
    text: `Şifrənizi yeniləmək üçün bu linkə keçin: ${link}. Link 30 dəqiqə etibarlıdır.`,
    html: layout(
      "Şifrə bərpası",
      `Şifrənizi yeniləmək üçün <a href="${link}">bu linkə</a> keçin. Link 30 dəqiqə etibarlıdır.`,
    ),
  };
}

export function phoneCodeTemplate(code: string): MailTemplate {
  return {
    subject: "ALVER telefon təsdiq kodu",
    text: `Təsdiq kodunuz: ${code}. Kod 10 dəqiqə etibarlıdır.`,
    html: layout("Telefon təsdiqi", `Təsdiq kodunuz: <strong>${code}</strong>. Kod 10 dəqiqə etibarlıdır.`),
  };
}
