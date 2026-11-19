/** 标签输入：输入后回车或逗号加一个，chip 上的 ✕ 删一个，空输入时退格删最后一个。 */
import { platform, signal, Text, View } from "nsh";
import { Button as BaseButton, Input } from "nsh/base";
import { Appear } from "./appear";
import { fieldState } from "./field";
import { Icon } from "./icon";

const pointer = platform.desktop;

export interface TagInputProps {
  label: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  /** 最多几个；满了输入框变只读并提示。 */
  max: number;
  /** 每个最多几个字（输入框直接限长）。 */
  maxLength: number;
  placeholder?: string;
  invalid?: boolean;
  onBlur?: () => void;
  testID?: string;
}

/** 输入里的逗号（中英文）都算分隔。 */
const SEPARATOR = /[,，]/;

export function TagInput(props: TagInputProps) {
  const text = signal("");
  const full = () => props.tags.length >= props.max;

  /** 加入若干个；去掉首尾空白、空的、重复的，超过上限的丢掉。 */
  const add = (parts: string[]) => {
    const next = [...props.tags];
    for (const part of parts) {
      const tag = part.trim();
      if (tag && !next.includes(tag) && next.length < props.max) next.push(tag);
    }
    if (next.length !== props.tags.length) props.onChange(next);
  };
  const remove = (tag: string) => props.onChange(props.tags.filter((t) => t !== tag));

  const change = (value: string) => {
    if (!SEPARATOR.test(value)) return text.set(value);
    const parts = value.split(SEPARATOR);
    // 最后一段还在输入，留在框里。
    text.set(parts.pop() ?? "");
    add(parts);
  };

  return (
    <View
      testID={props.testID}
      class={`flex-row flex-wrap items-center gap-1.5 rounded-(--radius) border bg-field px-1.5 py-1 transition-colors duration-120 focus-within:outline-2 focus-within:outline-offset-1 motion-reduce:transition-none ${fieldState(props.invalid, "focus-within")}`}
      classList={{
        "min-h-9": pointer,
        "min-h-11": !pointer,
      }}
    >
      <Each of={props.tags} key={(t) => t}>
        {(tag) => (
          <Appear kind="label">
            <View class="h-6 flex-row items-center gap-0.5 rounded-full bg-primary-tint pl-2.5 pr-1">
              <Text class="text-xs text-primary">{tag()}</Text>
              <BaseButton
                accessibilityLabel={`移除标签 ${tag()}`}
                onPress={() => remove(tag())}
                hitSlop={pointer ? 4 : 10}
                class="size-5 items-center justify-center rounded-full text-primary transition duration-180 ease-settle hover:bg-primary/15 active:scale-[0.95] active:bg-primary/25 focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none"
              >
                <Icon name="close" size="sm" />
              </BaseButton>
            </View>
          </Appear>
        )}
      </Each>
      <Input
        accessibilityLabel={props.label}
        accessibilityHint={`回车或逗号添加，最多 ${props.max} 个`}
        value={text()}
        onChange={({ value }) => change(value)}
        onSubmit={() => {
          add([text()]);
          text.set("");
        }}
        onKeyPress={({ key }) => {
          if (key === "Backspace" && text() === "" && props.tags.length) remove(props.tags[props.tags.length - 1]);
        }}
        onBlur={() => {
          if (text().trim()) {
            add([text()]);
            text.set("");
          }
          props.onBlur?.();
        }}
        submitBehavior="submit"
        maxLength={props.maxLength}
        readonly={full()}
        placeholder={full() ? `最多 ${props.max} 个` : props.tags.length ? "" : props.placeholder}
        class="min-w-24 flex-1 px-1.5 py-1 text-sm text-strong placeholder:text-faint"
      />
    </View>
  );
}
