## Markdown Help Text

### Callouts

> [!TIP]
> This is an example of a typed call out. This component support:
> - *<span style="color:#0078d4">Note</span>*
> - *<span style="color:#107c10">Tip</span>*
> - *<span style="color:#8764b8">Important</span>*
> - *<span style="color:#b45400">Warning</span>*
> - *<span style="color:#d13438">Caution</span>*

This is an example of a regular callout:
> This is how we dynamically pull values from this record: **{!hek_name}** - **{!createdon}** and from related records: **{!createdby:fullname}**.

### Tables
You can even render tables:

| Item | Color | Flavor |
| -------- | :------: | -------: |
| **Apples**    | <span style="color:red">red</span> | sweet    |
| **Lemons**    | <span style="color:#d4b106">yellow</span> | sour    |
| **Carrots**   | <span style="color:orange">orange</span> | crunchy    |

### Images
And images as base64 or using a link. Use plain Markdown image syntax for full width, or an HTML `<img>` tag with a `width` attribute to render at a specific size:
<img src="https://share.henken.tech/raw/BS1o3U.png" alt="Alt text" width="50">