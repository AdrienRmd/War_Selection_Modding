import { AtlasHeader, AtlasFooter, PageTitle } from "@/components/atlas-shell";
import { T } from "@/components/i18n";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { CreatorApplicationForm } from "@/components/creator-application-form";
import { pageMetadata } from "@/lib/page-metadata";
import { LogIn, UserPlus, ShieldCheck } from "lucide-react";
import "../../creators.css";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return pageMetadata("creatorApply");
}

const RETURN_TO = encodeURIComponent("/createurs/candidature");

/** Page /createurs/candidature — formulaire « devenir créateur ».
 *  Visiteur NON connecté (décision 08/11) : au lieu d'une redirection
 *  brute vers /signin, un état dédié explique les 2 étapes (1. compte,
 *  2. examen par les administrateurs) avec retour vers la candidature.
 *  Les boutons pointent vers /signin et /signup avec return_to — passer
 *  par /account anonyme perdrait le retour (requireChatGPTUser("/account")).
 *  Connecté : formulaire inchangé. */
export default async function CreatorApplyPage() {
  const user = await getChatGPTUser();
  return (
    <>
      <AtlasHeader />
      <main className="shell">
        <PageTitle
          eyebrow="CREATORS"
          title="成为内容创作者"
          text="提交后会由管理员审核：名称、简介、社交链接与要关联的作品都可以在这里填写。"
        />
        {user ? (
          <CreatorApplicationForm defaultName={user.displayName} />
        ) : (
          <section className="panel creator-apply-anon">
            <h2 className="heading-3">
              <T text="两步即可申请" />
            </h2>
            <ol className="creator-apply-steps">
              <li>
                <span className="creator-apply-step-num" aria-hidden="true">1</span>
                <div className="creator-apply-step-body">
                  <p className="creator-apply-step-title">
                    <T text="创建账号或登录" />
                  </p>
                  <p className="label-text">
                    <T text="需要一个 WS ATLAS 账号来提交和管理你的创作者档案。" />
                  </p>
                </div>
              </li>
              <li>
                <span className="creator-apply-step-num" aria-hidden="true">2</span>
                <div className="creator-apply-step-body">
                  <p className="creator-apply-step-title">
                    <T text="填写并提交申请" />
                  </p>
                  <p className="label-text">
                    <T text="管理员会审核名称、简介、社交链接与作品，通过后你的公开页面随即上线。" />
                  </p>
                </div>
              </li>
            </ol>
            <p className="creator-apply-moderation label-text">
              <ShieldCheck size={14} aria-hidden="true" />
              <T text="所有申请都由人工审核，通常需要几天时间。" />
            </p>
            <div className="creator-apply-actions">
              <a className="button" href={`/signin?return_to=${RETURN_TO}`}>
                <LogIn size={16} />
                <T text="登录" />
              </a>
              <a className="button button-secondary" href={`/signup?return_to=${RETURN_TO}`}>
                <UserPlus size={16} />
                <T text="创建账号" />
              </a>
            </div>
          </section>
        )}
      </main>
      <AtlasFooter />
    </>
  );
}
