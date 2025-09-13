#!/bin/bash

# LegalTechOps PCF Components Release Script (Simplified)
# This script increments version numbers and creates a release

set -e
echo "🚀 LegalTechOps PCF Components Release Script"
echo "============================================="

# Check if we're in the correct directory
if [ ! -f "LegalTechOpsCustomComponents.cdsproj" ]; then
    echo "❌ Error: This script must be run from the root directory containing LegalTechOpsCustomComponents.cdsproj"
    exit 1
fi

# Function to increment version
increment_version() {
    local file_path="$1"
    local version_part="$2"
    
    echo "📝 Processing: $file_path" >&2
    
    # Extract current control version specifically
    current_version=$(grep '<control.*version=' "$file_path" | grep -o 'version="[^"]*"' | head -1 | sed 's/version="//g' | sed 's/"//g')
    
    if [ -z "$current_version" ]; then
        echo "⚠️  Warning: Could not find control version in $file_path" >&2
        return 1
    fi
    
    echo "   Current version: $current_version" >&2
    
    # Split version into parts
    IFS='.' read -ra VERSION_PARTS <<< "$current_version"
    major=${VERSION_PARTS[0]:-1}
    minor=${VERSION_PARTS[1]:-0}
    build=${VERSION_PARTS[2]:-0}
    revision=${VERSION_PARTS[3]:-0}
    
    # Increment the specified part
    case $version_part in
        "major")
            major=$((major + 1))
            minor=0
            build=0
            revision=0
            ;;
        "minor")
            minor=$((minor + 1))
            build=0
            revision=0
            ;;
        "build")
            build=$((build + 1))
            revision=0
            ;;
        "revision")
            revision=$((revision + 1))
            ;;
    esac
    
    new_version="$major.$minor.$build.$revision"
    echo "   New version: $new_version" >&2
    
    # Update the control version only
    sed -i.bak "s/<control\([^>]*\)version=\"[^\"]*\"/<control\1version=\"$new_version\"/" "$file_path"
    
    if [ $? -eq 0 ]; then
        rm -f "${file_path}.bak"
        echo "   ✅ Updated successfully" >&2
        echo "$new_version"
    else
        echo "   ❌ Failed to update version" >&2
        return 1
    fi
}

# Prompt for version increment
echo
echo "Which version level do you want to increment?"
echo "1) Major (x.0.0.0)"
echo "2) Minor (x.x.0.0)"
echo "3) Build (x.x.x.0)"
echo "4) Revision (x.x.x.x)"
read -p "Enter choice [1-4]: " VERSION_LEVEL

case $VERSION_LEVEL in
    1) VERSION_PART="major" ;;
    2) VERSION_PART="minor" ;;
    3) VERSION_PART="build" ;;
    4) VERSION_PART="revision" ;;
    *) 
        echo "❌ Invalid choice. Exiting."
        exit 1
        ;;
esac

echo
echo "🔍 Finding PCF components..."

# Find and process components
RELEASE_VERSION=""
processed_count=0

for dir in src/*/; do
    component_name=$(basename "$dir")
    
    # Skip the 'Other' directory
    if [ "$component_name" = "Other" ]; then
        continue
    fi
    
    # Look for manifest files
    manifest_file=""
    if [ -f "${dir}${component_name}/ControlManifest.Input.xml" ]; then
        manifest_file="${dir}${component_name}/ControlManifest.Input.xml"
    elif [ -f "${dir}ControlManifest.Input.xml" ]; then
        manifest_file="${dir}ControlManifest.Input.xml"
    fi
    
    if [ -n "$manifest_file" ] && [ -f "$manifest_file" ]; then
        echo "🔧 Processing component: $component_name"
        new_version=$(increment_version "$manifest_file" "$VERSION_PART")
        if [ $? -eq 0 ] && [ -n "$new_version" ]; then
            RELEASE_VERSION="$new_version"
            processed_count=$((processed_count + 1))
        fi
    else
        echo "⚠️  Skipping $component_name (no manifest found)"
    fi
done

if [ $processed_count -eq 0 ]; then
    echo "❌ No components were processed. Exiting."
    exit 1
fi

echo
echo "📦 Creating release..."
echo "   Components processed: $processed_count"
echo "   Release version: $RELEASE_VERSION"

# Add changes to git
git add .

# Create commit
commit_msg="chore: release version $RELEASE_VERSION"
git commit -m "$commit_msg"

# Create tag
tag_name="v$RELEASE_VERSION"
git tag -a "$tag_name" -m "Release version $RELEASE_VERSION"

echo
echo "✅ Release $RELEASE_VERSION completed successfully!"
echo
echo "📋 Summary:"
echo "   - Version: $RELEASE_VERSION"
echo "   - Components updated: $processed_count"
echo "   - Commit: $commit_msg"
echo "   - Tag: $tag_name"
echo
echo "🚀 To push to remote:"
echo "   git push origin main"
echo "   git push origin $tag_name"
echo